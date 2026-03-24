import { useState } from 'react';
import { DEFAULT_GROUP_ID } from './constants/config';

// Hooks
import useToast from './hooks/useToast';
import useConfirmDialog from './hooks/useConfirmDialog';
import useAuth from './hooks/useAuth';
import useProducts from './hooks/useProducts';
import useTasks from './hooks/useTasks';
import useHistory from './hooks/useHistory';
import useSidebar from './hooks/useSidebar';

// Components
import GlobalStyles from './components/GlobalStyles';
import Toast from './components/Toast';
import ConfirmDialog from './components/ConfirmDialog';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

// Pages
import LoginPage from './pages/LoginPage';
import ProductListPage from './pages/ProductListPage';
import SchedulePage from './pages/SchedulePage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';

// Modals
import ProductEditModal from './modals/ProductEditModal';
import ScheduleConfirmModal from './modals/ScheduleConfirmModal';
import TaskEditModal from './modals/TaskEditModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('productList');
  const communityId = DEFAULT_GROUP_ID;

  // --- Hooks ---
  const { toast, showToast } = useToast();
  const { confirmDialog, showConfirm, closeConfirm } = useConfirmDialog();
  const { historyLogs, isLoadingHistory, fetchHistoryLogs } = useHistory(communityId);

  const {
    products, setProducts, isLoading, isLoadingMore, isFilterOpen, setIsFilterOpen,
    filters, setFilters, pagingAfter, productEditModal, setProductEditModal,
    fetchProductsWithArgs, resetFilters, openProductEditModal, closeProductEditModal, handleUpdateProduct
  } = useProducts(communityId, showToast);

  const {
    tasks, setTasks, scheduleForm, setScheduleForm, productSearchTerm, setProductSearchTerm,
    isProductSelectOpen, setIsProductSelectOpen, productSelectRef, recentProducts, setRecentProducts,
    isDatePickerOpen, setIsDatePickerOpen, pickerDate, pickerTime, setPickerDate, setPickerTime,
    confirmedDateTime, isConfirmModalOpen, setIsConfirmModalOpen, editModal, setEditModal,
    fetchScheduledTasks, handleSelectProduct, handleRemoveProduct, handleProductKeyDown,
    handleConfirmDatePicker, handlePreSubmit, handleConfirmRegister, handleDeleteTask,
    openEditModal, handleConfirmEdit
  } = useTasks(communityId, showToast, activeTab);

  const onLoginSuccess = (accessToken, finalSellerId, savedLoginMode, savedRecentProducts) => {
    fetchProductsWithArgs(accessToken, finalSellerId, savedLoginMode, false);
    fetchScheduledTasks(accessToken);
    if (savedRecentProducts) {
      try { setRecentProducts(JSON.parse(savedRecentProducts)); } catch(e) {}
    }
  };

  const {
    isAuthenticated, token, sellerId, setSellerId, loginMode, setLoginMode, isLoginProcessing,
    handleOAuthLogin, handleLogout
  } = useAuth(communityId, showToast, onLoginSuccess);

  const { isSidebarOpen, setIsSidebarOpen, indicatorStyle, navRef } = useSidebar(activeTab);

  // --- Derived values ---
  const displayedTasks = tasks.filter(task => products.some(p => p.id === task.productId));
  const filteredProducts = products.filter(p => p.name.includes(productSearchTerm) || p.id.includes(productSearchTerm));

  // --- Login screen ---
  if (!isAuthenticated) {
    return (
      <LoginPage
        loginMode={loginMode} setLoginMode={setLoginMode}
        sellerId={sellerId} setSellerId={setSellerId}
        onLogin={handleOAuthLogin} isLoginProcessing={isLoginProcessing}
        toast={toast} confirmDialog={confirmDialog} closeConfirm={closeConfirm}
      />
    );
  }

  // --- Dashboard ---
  return (
    <>
      <GlobalStyles />
      <div className="flex h-screen w-screen bg-gradient-to-br from-indigo-50 via-slate-50 to-purple-50 text-slate-800 font-sans overflow-hidden p-2 md:p-4 gap-4 relative">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-30 pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-30 pointer-events-none"></div>
        <div className="relative z-[2000]">
          <Toast toast={toast} />
          <ConfirmDialog confirmDialog={confirmDialog} onClose={closeConfirm} />
        </div>
        {isSidebarOpen && <div className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm md:hidden" onClick={() => setIsSidebarOpen(false)}></div>}

        <Sidebar
          activeTab={activeTab} setActiveTab={setActiveTab}
          isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}
          indicatorStyle={indicatorStyle} navRef={navRef}
          onLogout={() => handleLogout(() => { setActiveTab('productList'); setProducts([]); setTasks([]); })}
          fetchHistoryLogs={() => fetchHistoryLogs(token)}
        />

        <main className="flex-1 flex flex-col gap-4 overflow-hidden z-10 w-full relative">
          <Header
            activeTab={activeTab} sellerId={sellerId} loginMode={loginMode}
            isSidebarOpen={isSidebarOpen} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          />
          <div className="flex-1 overflow-hidden relative">
            {activeTab === 'productList' && (
              <ProductListPage
                products={products} isLoading={isLoading} sellerId={sellerId} loginMode={loginMode}
                filters={filters} setFilters={setFilters} isFilterOpen={isFilterOpen} setIsFilterOpen={setIsFilterOpen}
                applyFilters={() => { fetchProductsWithArgs(token, sellerId, loginMode, false); }}
                resetFilters={resetFilters} pagingAfter={pagingAfter} isLoadingMore={isLoadingMore}
                loadMoreProducts={() => fetchProductsWithArgs(token, sellerId, loginMode, true)}
                openProductEditModal={openProductEditModal}
              />
            )}
            {activeTab === 'schedule' && (
              <SchedulePage
                products={products} scheduleForm={scheduleForm} setScheduleForm={setScheduleForm}
                productSearchTerm={productSearchTerm} setProductSearchTerm={setProductSearchTerm}
                isProductSelectOpen={isProductSelectOpen} setIsProductSelectOpen={setIsProductSelectOpen}
                productSelectRef={productSelectRef} filteredProducts={filteredProducts}
                handleSelectProduct={handleSelectProduct} handleRemoveProduct={handleRemoveProduct}
                handleProductKeyDown={(e) => handleProductKeyDown(e, products)}
                handlePreSubmit={handlePreSubmit}
                isDatePickerOpen={isDatePickerOpen} setIsDatePickerOpen={setIsDatePickerOpen}
                pickerDate={pickerDate} pickerTime={pickerTime} setPickerDate={setPickerDate} setPickerTime={setPickerTime}
                handleConfirmDatePicker={handleConfirmDatePicker} confirmedDateTime={confirmedDateTime}
                displayedTasks={displayedTasks} fetchScheduledTasks={() => fetchScheduledTasks(token)}
                openEditModal={openEditModal} handleDeleteTask={(t) => handleDeleteTask(t, token)} isLoading={isLoading}
              />
            )}
            {activeTab === 'history' && (
              <HistoryPage historyLogs={historyLogs} isLoadingHistory={isLoadingHistory} fetchHistoryLogs={() => fetchHistoryLogs(token)} />
            )}
            {activeTab === 'settings' && (
              <SettingsPage sellerId={sellerId} loginMode={loginMode} />
            )}
          </div>
        </main>

        {productEditModal.isOpen && (
          <ProductEditModal
            productEditModal={productEditModal} setProductEditModal={setProductEditModal}
            onClose={closeProductEditModal} onSave={() => handleUpdateProduct(token, sellerId)}
          />
        )}
        <ScheduleConfirmModal
          isOpen={isConfirmModalOpen} scheduleForm={scheduleForm}
          confirmedDateTime={confirmedDateTime}
          onClose={() => setIsConfirmModalOpen(false)} onConfirm={() => handleConfirmRegister(token)}
        />
        <TaskEditModal
          editModal={editModal} setEditModal={setEditModal}
          onConfirm={() => handleConfirmEdit(token)} onClose={() => setEditModal({...editModal, isOpen: false})}
        />
      </div>
    </>
  );
}
