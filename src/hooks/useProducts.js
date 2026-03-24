import { useState } from 'react';
import { fetchProducts as apiFetchProducts, updateProduct as apiUpdateProduct } from '../api/products';

export default function useProducts(communityId, showToast) {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ name: '', sku: '', tag: '', status: [], display: 'all' });
  const [pagingAfter, setPagingAfter] = useState(null);
  const [productEditModal, setProductEditModal] = useState({
    isOpen: false, id: '', name: '', price: '', stockType: 'unlimited', stockCount: '', isDisplayed: 'true', status: 'onSale', description: '', _original: null
  });

  const fetchProductsWithArgs = async (currentToken, currentSellerId, currentMode, isLoadMore = false) => {
    if (currentMode === 'seller' && !currentSellerId) return;
    if (isLoadMore) setIsLoadingMore(true);
    else setIsLoading(true);
    try {
      if (!currentToken) throw new Error("유효한 토큰이 없습니다.");
      const result = await apiFetchProducts(currentToken, communityId, {
        sellerId: currentSellerId, loginMode: currentMode, filters, pagingAfter: isLoadMore ? pagingAfter : null
      });
      if (isLoadMore) setProducts(prev => [...prev, ...result.list]);
      else setProducts(result.list);
      setPagingAfter(result.pagingAfter);
    } catch (err) {
      showToast('목록 로드 실패: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const resetFilters = () => setFilters({ name: '', sku: '', tag: '', status: [], display: 'all' });

  const openProductEditModal = (p) => {
    setProductEditModal({
      isOpen: true, id: p.id, name: p.name || '', price: p.price || 0,
      stockType: p.stockCount === null || p.stockCount === undefined ? 'unlimited' : 'limited',
      stockCount: p.stockCount || '', isDisplayed: p.isDisplayed !== false ? 'true' : 'false',
      status: p.status || 'onSale', description: p.description || '',
      _original: p
    });
  };

  const closeProductEditModal = () => setProductEditModal(prev => ({ ...prev, isOpen: false }));

  const handleUpdateProduct = async (token, sellerId) => {
    const { id, name, price, stockType, stockCount, isDisplayed, status, description, _original } = productEditModal;

    if (!_original) {
      showToast('원본 상품 데이터를 찾을 수 없어 수정할 수 없습니다.', 'error');
      return;
    }

    const payload = {
      name, price: Number(price), status, isDisplayed: isDisplayed === 'true',
      blocks: _original.blocks || [],
    };

    if (stockType === 'limited') payload.stockCount = Number(stockCount);
    else payload.stockCount = null;

    if (description && description.trim() !== '') payload.description = description;

    const allowedOptionalFields = [
      'categoryIds', 'deliveryGroupId', 'deliveryPolicies', 'details',
      'hsCode', 'normalPrice', 'originalPrice', 'primaryDetails',
      'returnReplacementPolicy', 'shippingFee', 'sku', 'supplyPrice', 'weight'
    ];
    allowedOptionalFields.forEach(field => {
      if (_original[field] !== undefined && _original[field] !== null) payload[field] = _original[field];
    });

    if (_original.images) {
      const extractUrlString = (img) => typeof img === 'string' ? img : (img?.url || '');
      if (Array.isArray(_original.images)) {
        payload.images = { mobile: _original.images.map(extractUrlString).filter(Boolean), web: [] };
      } else {
        payload.images = {
          mobile: Array.isArray(_original.images.mobile) ? _original.images.mobile.map(extractUrlString).filter(Boolean) : [],
          web: Array.isArray(_original.images.web) ? _original.images.web.map(extractUrlString).filter(Boolean) : []
        };
      }
    } else {
      payload.images = { mobile: [], web: [] };
    }

    try {
      showToast('상품 정보를 갱신 중입니다...', 'info');
      await apiUpdateProduct(token, communityId, sellerId, id, payload);
      setProducts(prev => prev.map(p => p.id === id ? { ...p, ...payload } : p));
      closeProductEditModal();
      showToast('상품이 성공적으로 수정되었습니다.', 'success');
    } catch (err) {
      showToast(`수정 실패: ${err.message}`, 'error');
    }
  };

  return {
    products, setProducts, isLoading, isLoadingMore, isFilterOpen, setIsFilterOpen,
    filters, setFilters, pagingAfter, productEditModal, setProductEditModal,
    fetchProductsWithArgs, resetFilters, openProductEditModal, closeProductEditModal, handleUpdateProduct
  };
}
