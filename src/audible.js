const axios = require('axios');
const cheerio = require('cheerio');
const moment = require('moment');

async function update(ratingKey) {

  if (!ratingKey.match(/[0-9A-Z]{10}/)){
    console.log(`[Audible] ${ratingKey} doesn't look like a valid Audible ASIN, not fetching metadata.`);
    return;
  }

  console.log(`[Audible] Fetching full metadata for id: ${ratingKey}`);
  try {
    // First try loading the product info from the API.
    const url = `https://api.audible.com/1.0/catalog/products/${ratingKey}?response_groups=product_attrs,contributors,product_extended_attrs,media&image_sizes=360,1024`;
    const res = await axios.get(url);
    const product = res.data.product;

    if (!!product.title && !!product.authors) {
      // This looks like a book with solid product info in the API, we'll go that route.
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

    } else {
      // We have what looks like a valid ASIN but no product info (likely an author), let's have a look at the site...
      const url = `https://www.audible.com/author/${ratingKey}`;
      const res = await axios.get(url);
      const $ = cheerio.load(res.data);
      let title, summary, thumb;

      // Name.
      try {
        title = $('h1.bc-text-bold')[0].children[0].data;
      } catch (err) {
        console.error(err);
      }

      // Bio.
      try {
        summary = $('div.bc-expander-content').children().text();
      } catch (err) {
        console.error(err);
      }

      // Image.
      try {
        // We'll ask for a *slightly* larger than postage-stamp-sized pic...
        thumb = $('img.author-image-outline')[0].attribs.src.replaceAll('120', '240');
      } catch (err) {
        console.error(err);
      }

      return { ratingKey, thumb, title, summary, narrators: [] }
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
  const match = title.match(/\[.*(?<asin>[A-Z0-9]{10})]/);
  if (match) {
    console.log(`[Audible] Using Audible ID (ASIN): ${match.groups.asin}`);
    return [await update(match.groups.asin)];
  }

  console.log(`[Audible] Searching for title: ${title} by ${parentTitle}`);
  try {
    const url = `https://api.audible.com/1.0/screens/audible-browse/search-ios?content_type=Audiobook&keywords=${encodeURIComponent(title)}%20${encodeURIComponent(parentTitle)}`
    const res = await axios.get(url);

    // Look for a `section` with `items`. We've seen this appear at various positions in the list.
    let section;
    if (res.data.sections.length > 0)
      section = res.data.sections.find(section => { return !!section.model && !!section.model.items && section.model.items.length > 0 });

    if (section && section.model.api_data.result_count.total > 0 ) {
      return await Promise.all(section.model.items.map(async item => {
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
