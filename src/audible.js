const axios = require('axios');
const moment = require('moment');

async function update(ratingKey) {
  console.log(`[Audible] Fetching full metadata for id: ${ratingKey}`);
  try {
    const url = `https://api.audible.com/1.0/catalog/products/${ratingKey}?response_groups=product_attrs,contributors,product_extended_attrs,media&image_sizes=360,1024`;
    const res = await axios.get(url);
    const product = res.data.product;

    if (!product.title || !product.authors ) {
      console.log(`[Audible] Product data missing for id ${ratingKey} (probably an author)`);
      return;
    }

    return {
      ratingKey: product.asin,
      thumb: !!product.product_images ? product.product_images['1024'] : null,
      title: product.title,
      parentTitle: product.authors[0].name,
      parentRatingKey: product.authors[0].asin || require('crypto').createHash('md5').update(product.authors[0].name).digest('hex'),
      originallyAvailableAt: moment(product.release_date).format(),
      summary: product.publisher_summary,
      publisher: product.publisher_name,
      narrators: product.narrators.map(narrator => narrator.name)
    }
  } catch (err) {
    console.error(err);
  }
}

async function match({ parentTitle, title, type }) {

  // Strip stuff in parens. Helps e.g. "(Unabridged)" in titles, and ad hoc narrator credits "(read by Michael Pritchard)" in authors names.
  title = title.replace(/\([^()]*\)/g, '');
  parentTitle = parentTitle.replace(/\([^()]*\)/g, '');

  // If we have an Audible ASIN (in square brackets) in the title, use it.
  const match = title.match(/\[.*(?<asin>B[A-Z0-9]{9})]/);
  if (match) {
    console.log(`[Audible] Using Audible ID (ASIN): ${match.groups.asin}`);
    return [await update(match.groups.asin)];
  }

  console.log(`[Audible] Searching for title: ${title} by ${parentTitle}`);
  try {
    const url = `https://api.audible.com/1.0/screens/audible-browse/search-ios?content_type=Audiobook&keywords=${encodeURIComponent(title)}%20${encodeURIComponent(parentTitle)}`
    const res = await axios.get(url);
    if (res.data.sections.length > 0 && res.data.sections[0].model.api_data.result_count.total > 0 ) {
      return await Promise.all(res.data.sections[0].model.items.map(async item => {
        const meta = item.model.product_metadata;
        const { parentTitle, parentRatingKey, originallyAvailableAt } = await update(meta.asin); //TODO: Could avoid extra requests if we can get these w/ search results.
        return({
          type,
          ratingKey: meta.asin,
          title: meta.title.value,
          parentTitle,
          parentRatingKey,
          originallyAvailableAt,
          ratingCount: meta.rating.count,
          thumb: meta.cover_art.url,
        })
      }))
    }
  } catch (err) {
    console.error(err);
  }
  return [];
}

module.exports = { match, update };
