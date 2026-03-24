export const translateStatus = (status) =>
  ({ scheduled: '판매예정', onSale: '판매중', soldOut: '품절', completed: '판매종료' }[status] || status);
