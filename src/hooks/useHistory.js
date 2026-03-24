import { useState } from 'react';
import { fetchHistory } from '../api/scheduler';

export default function useHistory(communityId) {
  const [historyLogs, setHistoryLogs] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const fetchHistoryLogs = async (currentToken) => {
    setIsLoadingHistory(true);
    try {
      const logs = await fetchHistory(currentToken, communityId);
      setHistoryLogs(logs);
    } catch (err) {
      console.error('히스토리 내역 조회 에러:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  return { historyLogs, isLoadingHistory, fetchHistoryLogs };
}
