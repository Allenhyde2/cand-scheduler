import { SCHEDULER_API_URL } from '../constants/config';

const getAuthHeaders = (token, communityId) => ({
  'content-type': 'application/json',
  'authorization': `Bearer ${token}`,
  'x-can-community-id': communityId,
});

export const listTasks = async (token, communityId) => {
  const res = await fetch(SCHEDULER_API_URL, {
    method: 'POST',
    headers: getAuthHeaders(token, communityId),
    body: JSON.stringify({ action: 'LIST', token, communityId })
  });
  if (!res.ok) {
    if (res.status === 500) return [];
    throw new Error(`서버 응답 오류: ${res.status}`);
  }
  const responseText = await res.text();
  let data;
  try { data = JSON.parse(responseText); }
  catch (e) { throw new Error("서버가 JSON이 아닌 데이터를 반환했습니다."); }
  const fetchedList = data.tasks || data.data || (Array.isArray(data) ? data : []);
  return fetchedList.map(task => ({
    ...task,
    logs: task.logs || [`☁️ 서버에서 저장된 예약 정보를 불러왔습니다. (${new Date().toLocaleTimeString()})`]
  }));
};

export const createTask = async (token, communityId, taskData) => {
  const res = await fetch(SCHEDULER_API_URL, {
    method: 'POST',
    headers: getAuthHeaders(token, communityId),
    body: JSON.stringify({ action: 'CREATE', ...taskData, token, communityId })
  });
  if (!res.ok) throw new Error('예약 생성 실패');
  return res.json();
};

export const updateTask = async (token, communityId, taskData) => {
  const res = await fetch(SCHEDULER_API_URL, {
    method: 'POST',
    headers: getAuthHeaders(token, communityId),
    body: JSON.stringify({ action: 'UPDATE', ...taskData, token, communityId })
  });
  if (!res.ok) throw new Error('예약 수정 실패');
  return res.json();
};

export const deleteTask = async (token, communityId, taskId) => {
  const res = await fetch(SCHEDULER_API_URL, {
    method: 'POST',
    headers: getAuthHeaders(token, communityId),
    body: JSON.stringify({ action: 'DELETE', taskId, token, communityId })
  });
  if (!res.ok) throw new Error('예약 삭제 실패');
  return res.json();
};

export const fetchHistory = async (token, communityId) => {
  const res = await fetch(SCHEDULER_API_URL, {
    method: 'POST',
    headers: getAuthHeaders(token, communityId),
    body: JSON.stringify({ action: 'HISTORY', token, communityId })
  });
  if (!res.ok) throw new Error(`히스토리 로드 실패: ${res.status}`);
  const data = await res.json();
  return data.logs || [];
};
