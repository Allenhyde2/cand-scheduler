import { useState, useEffect, useRef } from 'react';
import { listTasks, createTask, deleteTask as apiDeleteTask, updateTask as apiUpdateTask } from '../api/scheduler';
import { getCurrentLocalISOString } from '../utils/datetime';

export default function useTasks(communityId, showToast, activeTab) {
  const [tasks, setTasks] = useState([]);
  const [scheduleForm, setScheduleForm] = useState({ products: [], status: 'onSale', isDisplayed: 'true' });
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isProductSelectOpen, setIsProductSelectOpen] = useState(false);
  const [recentProducts, setRecentProducts] = useState([]);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [pickerDate, setPickerDate] = useState(getCurrentLocalISOString().split('T')[0]);
  const [pickerTime, setPickerTime] = useState(getCurrentLocalISOString().split('T')[1]);
  const [confirmedDateTime, setConfirmedDateTime] = useState(getCurrentLocalISOString());
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [editModal, setEditModal] = useState({
    isOpen: false, task: null, status: '', isDisplayed: 'true', date: '', time: '', isDatePickerOpen: false
  });
  const productSelectRef = useRef(null);

  useEffect(() => {
    if (activeTab === 'schedule') {
      const kstNow = getCurrentLocalISOString();
      setConfirmedDateTime(kstNow);
      setPickerDate(kstNow.split('T')[0]);
      setPickerTime(kstNow.split('T')[1]);
    }
  }, [activeTab]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (productSelectRef.current && !productSelectRef.current.contains(event.target)) setIsProductSelectOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchScheduledTasks = async (currentToken) => {
    try {
      const formattedTasks = await listTasks(currentToken, communityId);
      setTasks(formattedTasks);
    } catch (err) {
      console.error('예약 목록 조회 실패 상세 에러:', err);
    }
  };

  const handleSelectProduct = (product) => {
    if (!scheduleForm.products.find(p => p.id === product.id)) {
      setScheduleForm({ ...scheduleForm, products: [...scheduleForm.products, product] });
    }
    setProductSearchTerm('');
    setIsProductSelectOpen(false);
    const newRecents = [product, ...recentProducts.filter(p => p.id !== product.id)].slice(0, 5);
    setRecentProducts(newRecents);
    localStorage.setItem('cand_recent_products', JSON.stringify(newRecents));
  };

  const handleRemoveProduct = (productId) => {
    setScheduleForm({ ...scheduleForm, products: scheduleForm.products.filter(p => p.id !== productId) });
  };

  const handleProductKeyDown = (e, products) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const matched = products.filter(p => p.name.includes(productSearchTerm) || p.id.includes(productSearchTerm));
      if (matched.length > 0) handleSelectProduct(matched[0]);
    }
  };

  const handleConfirmDatePicker = (selectedD, selectedT) => {
    const finalDate = selectedD || pickerDate;
    const finalTime = selectedT || pickerTime;
    if (!finalDate || !finalTime) return showToast('날짜와 시간을 모두 선택해주세요.', 'error');
    setConfirmedDateTime(`${finalDate}T${finalTime}`);
    setIsDatePickerOpen(false);
  };

  const handlePreSubmit = (e) => {
    e.preventDefault();
    if (scheduleForm.products.length === 0) return showToast('최소 1개 이상의 상품을 선택해주세요.', 'error');
    if (!confirmedDateTime) return showToast('실행 일시를 설정해주세요.', 'error');
    const executeTime = new Date(confirmedDateTime).getTime();
    if (executeTime <= Date.now()) return showToast('실행 시간은 현재 시간 이후여야 합니다.', 'error');
    setIsConfirmModalOpen(true);
  };

  const handleConfirmRegister = async (token) => {
    setIsConfirmModalOpen(false);
    showToast('예약 전송 중...', 'info');
    try {
      const newTasks = [];
      await Promise.all(scheduleForm.products.map(async (prod) => {
        const newTaskId = Math.random().toString(36).substr(2, 9);
        await createTask(token, communityId, {
          taskId: newTaskId, productId: prod.id, productName: prod.name,
          newStatus: scheduleForm.status, newIsDisplayed: scheduleForm.isDisplayed === 'true',
          executeAt: new Date(confirmedDateTime).toISOString()
        });
        newTasks.push({
          id: newTaskId, productId: prod.id, productName: prod.name,
          newStatus: scheduleForm.status, newIsDisplayed: scheduleForm.isDisplayed === 'true',
          executeAt: new Date(confirmedDateTime).getTime(), status: 'cloud_scheduled',
          logs: ['✅ AWS EventBridge에 성공적으로 등록되었습니다.']
        });
      }));
      setTasks(prev => [...newTasks, ...prev]);

      const kstNow = getCurrentLocalISOString();
      setConfirmedDateTime(kstNow); setPickerDate(kstNow.split('T')[0]); setPickerTime(kstNow.split('T')[1]);

      setScheduleForm({ ...scheduleForm, products: [] });
      showToast(`${scheduleForm.products.length}건의 상품 예약이 전송되었습니다!`, 'success');
    } catch (err) { showToast('예약 전송 중 오류가 발생했습니다.', 'error'); }
  };

  const handleDeleteTask = async (task, token) => {
    if (!window.confirm(`[${task.productName}] 예약을 정말 삭제하시겠습니까?`)) return;
    try {
      showToast('삭제 중...', 'info');
      await apiDeleteTask(token, communityId, task.id);
      setTasks(prev => prev.filter(t => t.id !== task.id));
      showToast('예약이 취소되었습니다.', 'success');
    } catch (err) { showToast(`삭제 실패`, 'error'); }
  };

  const openEditModal = (task) => {
    const d = new Date(task.executeAt);
    const tzoffset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d.getTime() - tzoffset)).toISOString().slice(0, 16);
    const [date, time] = localISOTime.split('T');
    setEditModal({ isOpen: true, task, status: task.newStatus, isDisplayed: task.newIsDisplayed ? 'true' : 'false', date, time, isDatePickerOpen: false });
  };

  const handleConfirmEdit = async (token) => {
    if (!editModal.date || !editModal.time) return showToast('수정할 날짜와 시간을 입력해주세요.', 'error');
    const executeTimeIso = new Date(`${editModal.date}T${editModal.time}`).toISOString();
    try {
      showToast('수정 중...', 'info');
      await apiUpdateTask(token, communityId, {
        taskId: editModal.task.id, productId: editModal.task.productId,
        newStatus: editModal.status, newIsDisplayed: editModal.isDisplayed === 'true',
        executeAt: executeTimeIso
      });
      setTasks(prev => prev.map(t => t.id === editModal.task.id ? { ...t, newStatus: editModal.status, newIsDisplayed: editModal.isDisplayed === 'true', executeAt: new Date(`${editModal.date}T${editModal.time}`).getTime() } : t));
      setEditModal({ ...editModal, isOpen: false });
      showToast('예약이 수정되었습니다.', 'success');
    } catch (err) { showToast(`수정 실패`, 'error'); }
  };

  return {
    tasks, setTasks, scheduleForm, setScheduleForm, productSearchTerm, setProductSearchTerm,
    isProductSelectOpen, setIsProductSelectOpen, productSelectRef, recentProducts, setRecentProducts,
    isDatePickerOpen, setIsDatePickerOpen, pickerDate, pickerTime, setPickerDate, setPickerTime,
    confirmedDateTime, isConfirmModalOpen, setIsConfirmModalOpen, editModal, setEditModal,
    fetchScheduledTasks, handleSelectProduct, handleRemoveProduct, handleProductKeyDown,
    handleConfirmDatePicker, handlePreSubmit, handleConfirmRegister, handleDeleteTask,
    openEditModal, handleConfirmEdit
  };
}
