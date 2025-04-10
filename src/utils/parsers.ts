function sephoraParseProductDetails(url: string) {
  // https://www.sephora.com/api/v3/users/profiles/current/product/P393401
  // https://www.sephora.com/ca/en/product/nars-light-reflecting-advance-skincare-foundation-P479338?skuId=2514644&icid2=products%20grid:p479338:product
  // https://www.sephora.com/ca/en/product/P506548 <- productID only
  // https://www.sephora.com/ca/en/product/P506548?skuId=2666998 <- productID and skuID
  // So it can either have only the productID, or the productID and the skuID.

  console.log(`URL: ${url}`);

  const half = url.split("?");

  console.log(`Splitting in half ${half}`);

  const productIdRaw = half[0];
  const skuIdRaw = half[1];

  const productIdMatch = productIdRaw.match(/\/P\d+/);

  console.log(`ProductIdMatch = ${productIdMatch}`);

  const productId = productIdMatch ? productIdMatch[0].substring(1) : null;

  console.log(`productId = ${productId}`);

  // sephoraParseProductDetails(
  //   "https://www.sephora.com/ca/en/product/P506548?skuId=2666998"
  // );
}

sephoraParseProductDetails(
  "https://www.sephora.com/ca/en/product/nars-light-reflecting-advance-skincare-foundation-P479338?skuId=2514644&icid2=products%20grid:p479338:product"
);
export { sephoraParseProductDetails };
