/**
 * canD Scheduler - AWS Lambda Handler
 *
 * 상품 상태/진열 예약 변경을 위한 서버리스 스케줄러
 *
 * DynamoDB Tables:
 *   - cand-scheduler-tasks:   PK=communityId, SK=taskId
 *   - cand-scheduler-history: PK=communityId, SK=executedAt#taskId
 *
 * Actions: CREATE, LIST, UPDATE, DELETE, HISTORY, EXECUTE
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { EventBridgeClient, PutRuleCommand, PutTargetsCommand, DeleteRuleCommand, RemoveTargetsCommand } = require('@aws-sdk/client-eventbridge');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const eb = new EventBridgeClient({});

const TASKS_TABLE = process.env.TASKS_TABLE || 'cand-scheduler-tasks';
const HISTORY_TABLE = process.env.HISTORY_TABLE || 'cand-scheduler-history';
const LAMBDA_ARN = process.env.LAMBDA_ARN || '';

// --- CORS 헤더 ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-can-community-id, x-can-profile-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const respond = (statusCode, body) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

// --- 메인 핸들러 ---
exports.handler = async (event) => {
  // OPTIONS (CORS preflight)
  if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
    return respond(200, { message: 'OK' });
  }

  let body;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || {};
  } catch (e) {
    return respond(400, { error: 'Invalid JSON body' });
  }

  const { action, communityId, token } = body;

  if (!action) return respond(400, { error: 'action is required' });
  if (!communityId) return respond(400, { error: 'communityId is required' });

  try {
    switch (action) {
      case 'CREATE':  return await handleCreate(body);
      case 'LIST':    return await handleList(body);
      case 'UPDATE':  return await handleUpdate(body);
      case 'DELETE':  return await handleDelete(body);
      case 'HISTORY': return await handleHistory(body);
      case 'EXECUTE': return await handleExecute(body);
      default:        return respond(400, { error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error('Lambda Error:', err);
    return respond(500, { error: err.message || 'Internal server error' });
  }
};

// --- CREATE: 예약 생성 ---
async function handleCreate({ communityId, taskId, productId, productName, newStatus, newIsDisplayed, executeAt, token }) {
  if (!taskId || !productId || !executeAt) {
    return respond(400, { error: 'taskId, productId, executeAt are required' });
  }

  const item = {
    communityId,
    taskId,
    productId,
    productName: productName || '',
    newStatus: newStatus || 'onSale',
    newIsDisplayed: newIsDisplayed !== undefined ? newIsDisplayed : true,
    executeAt,
    token,
    createdAt: new Date().toISOString(),
    status: 'scheduled',
  };

  // DynamoDB에 저장
  await ddb.send(new PutCommand({ TableName: TASKS_TABLE, Item: item }));

  // EventBridge 스케줄 규칙 생성
  const ruleName = `cand-sched-${taskId}`;
  const scheduleDate = new Date(executeAt);
  // EventBridge cron: cron(분 시 일 월 ? 년)
  const cronExpr = `cron(${scheduleDate.getUTCMinutes()} ${scheduleDate.getUTCHours()} ${scheduleDate.getUTCDate()} ${scheduleDate.getUTCMonth() + 1} ? ${scheduleDate.getUTCFullYear()})`;

  await eb.send(new PutRuleCommand({
    Name: ruleName,
    ScheduleExpression: cronExpr,
    State: 'ENABLED',
    Description: `canD scheduler: ${productName} (${taskId})`,
  }));

  if (LAMBDA_ARN) {
    await eb.send(new PutTargetsCommand({
      Rule: ruleName,
      Targets: [{
        Id: `target-${taskId}`,
        Arn: LAMBDA_ARN,
        Input: JSON.stringify({
          body: JSON.stringify({
            action: 'EXECUTE',
            communityId,
            taskId,
          }),
        }),
      }],
    }));
  }

  // 규칙 이름을 DynamoDB에 업데이트
  item.ruleName = ruleName;
  await ddb.send(new PutCommand({ TableName: TASKS_TABLE, Item: item }));

  return respond(200, { taskId, status: 'scheduled', ruleName });
}

// --- LIST: 예약 목록 조회 ---
async function handleList({ communityId }) {
  const result = await ddb.send(new QueryCommand({
    TableName: TASKS_TABLE,
    KeyConditionExpression: 'communityId = :cid',
    ExpressionAttributeValues: { ':cid': communityId },
  }));

  const tasks = (result.Items || []).map(item => ({
    id: item.taskId,
    productId: item.productId,
    productName: item.productName,
    newStatus: item.newStatus,
    newIsDisplayed: item.newIsDisplayed,
    executeAt: new Date(item.executeAt).getTime(),
    status: item.status || 'cloud_scheduled',
    createdAt: item.createdAt,
  }));

  return respond(200, { tasks });
}

// --- UPDATE: 예약 수정 ---
async function handleUpdate({ communityId, taskId, productId, newStatus, newIsDisplayed, executeAt, token }) {
  if (!taskId || !executeAt) {
    return respond(400, { error: 'taskId and executeAt are required' });
  }

  // 기존 태스크 조회
  const existing = await ddb.send(new GetCommand({
    TableName: TASKS_TABLE,
    Key: { communityId, taskId },
  }));

  if (!existing.Item) return respond(404, { error: 'Task not found' });

  // 기존 EventBridge 규칙 삭제
  const oldRuleName = existing.Item.ruleName;
  if (oldRuleName) {
    try {
      await eb.send(new RemoveTargetsCommand({ Rule: oldRuleName, Ids: [`target-${taskId}`] }));
      await eb.send(new DeleteRuleCommand({ Name: oldRuleName }));
    } catch (e) { /* 규칙이 이미 없을 수 있음 */ }
  }

  // 새 항목 저장
  const updatedItem = {
    ...existing.Item,
    newStatus: newStatus || existing.Item.newStatus,
    newIsDisplayed: newIsDisplayed !== undefined ? newIsDisplayed : existing.Item.newIsDisplayed,
    executeAt,
    token: token || existing.Item.token,
    updatedAt: new Date().toISOString(),
  };

  await ddb.send(new PutCommand({ TableName: TASKS_TABLE, Item: updatedItem }));

  // 새 EventBridge 규칙 생성
  const newRuleName = `cand-sched-${taskId}`;
  const scheduleDate = new Date(executeAt);
  const cronExpr = `cron(${scheduleDate.getUTCMinutes()} ${scheduleDate.getUTCHours()} ${scheduleDate.getUTCDate()} ${scheduleDate.getUTCMonth() + 1} ? ${scheduleDate.getUTCFullYear()})`;

  await eb.send(new PutRuleCommand({
    Name: newRuleName,
    ScheduleExpression: cronExpr,
    State: 'ENABLED',
  }));

  if (LAMBDA_ARN) {
    await eb.send(new PutTargetsCommand({
      Rule: newRuleName,
      Targets: [{
        Id: `target-${taskId}`,
        Arn: LAMBDA_ARN,
        Input: JSON.stringify({
          body: JSON.stringify({ action: 'EXECUTE', communityId, taskId }),
        }),
      }],
    }));
  }

  updatedItem.ruleName = newRuleName;
  await ddb.send(new PutCommand({ TableName: TASKS_TABLE, Item: updatedItem }));

  return respond(200, { updated: true, taskId });
}

// --- DELETE: 예약 삭제 ---
async function handleDelete({ communityId, taskId }) {
  if (!taskId) return respond(400, { error: 'taskId is required' });

  // 기존 항목 조회 (규칙 이름 확인)
  const existing = await ddb.send(new GetCommand({
    TableName: TASKS_TABLE,
    Key: { communityId, taskId },
  }));

  // EventBridge 규칙 삭제
  const ruleName = existing.Item?.ruleName || `cand-sched-${taskId}`;
  try {
    await eb.send(new RemoveTargetsCommand({ Rule: ruleName, Ids: [`target-${taskId}`] }));
    await eb.send(new DeleteRuleCommand({ Name: ruleName }));
  } catch (e) { /* 규칙이 없을 수 있음 */ }

  // DynamoDB 삭제
  await ddb.send(new DeleteCommand({
    TableName: TASKS_TABLE,
    Key: { communityId, taskId },
  }));

  return respond(200, { deleted: true, taskId });
}

// --- HISTORY: 실행 로그 조회 ---
async function handleHistory({ communityId }) {
  const result = await ddb.send(new QueryCommand({
    TableName: HISTORY_TABLE,
    KeyConditionExpression: 'communityId = :cid',
    ExpressionAttributeValues: { ':cid': communityId },
    ScanIndexForward: false, // 최신순
    Limit: 100,
  }));

  const logs = (result.Items || []).map(item => ({
    taskId: item.taskId,
    productId: item.productId,
    productName: item.productName,
    success: item.success,
    message: item.message,
    executedAt: item.executedAt,
    newStatus: item.newStatus,
    newIsDisplayed: item.newIsDisplayed,
  }));

  return respond(200, { logs });
}

// --- EXECUTE: EventBridge에 의해 트리거됨 ---
async function handleExecute({ communityId, taskId }) {
  // 태스크 조회
  const result = await ddb.send(new GetCommand({
    TableName: TASKS_TABLE,
    Key: { communityId, taskId },
  }));

  const task = result.Item;
  if (!task) {
    console.error(`Task not found: ${communityId}/${taskId}`);
    return respond(404, { error: 'Task not found' });
  }

  const { productId, productName, newStatus, newIsDisplayed, token } = task;
  let success = false;
  let message = '';

  try {
    // canD API PUT 호출
    const apiUrl = `https://api.cand.xyz/products/${encodeURIComponent(productId)}`;
    const payload = {
      status: newStatus,
      isDisplayed: newIsDisplayed,
    };

    const res = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-can-community-id': communityId,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      success = true;
      message = `상태 변경 완료: ${newStatus}, 진열: ${newIsDisplayed ? '표시' : '숨김'}`;
    } else {
      const errBody = await res.text();
      message = `API 오류 ${res.status}: ${errBody}`;
    }
  } catch (err) {
    message = `실행 중 오류: ${err.message}`;
  }

  // 히스토리 테이블에 결과 기록
  const executedAt = new Date().toISOString();
  await ddb.send(new PutCommand({
    TableName: HISTORY_TABLE,
    Item: {
      communityId,
      sortKey: `${executedAt}#${taskId}`,
      taskId,
      productId,
      productName,
      newStatus,
      newIsDisplayed,
      success,
      message,
      executedAt,
    },
  }));

  // 완료된 태스크 삭제
  await ddb.send(new DeleteCommand({
    TableName: TASKS_TABLE,
    Key: { communityId, taskId },
  }));

  // EventBridge 규칙 정리
  const ruleName = task.ruleName || `cand-sched-${taskId}`;
  try {
    await eb.send(new RemoveTargetsCommand({ Rule: ruleName, Ids: [`target-${taskId}`] }));
    await eb.send(new DeleteRuleCommand({ Name: ruleName }));
  } catch (e) { /* 규칙 정리 실패 무시 */ }

  return respond(200, { success, message, taskId });
}
