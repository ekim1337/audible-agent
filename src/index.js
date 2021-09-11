
const express = require( 'express' );
const convert = require('xml-js');
const audible = require( './audible' );

const { MediaProvider, MediaContainer, Directory, Tag } = require('./xml-types');

const port = process.env.PORT || 3000;

const logRequest = (req, res, next) => {
  console.log(`\x1b[34m[${req.method}]\x1b[0m ${req.url} -> \x1b[37m${res.statusCode}\x1b[0m`);
  next();
}

const xml = obj => {
  obj.declaration = { attributes: { version: '1.0' }};
  const xml = convert.js2xml(obj, { spaces: '  ' });
  console.debug(`\x1b[2m${xml}\x1b[0m`)
  return xml;
}

const provider = new MediaProvider({
  title: 'Audible',
  features: [
    { type: 'metadata', key: '/library/metadata' },
    { type: 'match', key: '/library/metadata/matches' }
  ]
});

const app = express();
app.use(logRequest);
app.use(express.json());

app.get('/', (req, res) => {
  res.send(xml( provider ));
});

app.get('/library/metadata/:id', async (req, res) => {
  const audibleMeta = await audible.update(req.params.id);
  if (!audibleMeta)
    return res.send(xml( new MediaContainer({}) ));

  const { title, ratingKey, thumb, parentTitle, parentRatingKey, originallyAvailableAt, summary, publisher, narrators } = audibleMeta;
  const metadata = new MediaContainer({
    children: [new Directory({
      title,
      ratingKey,
      thumb,
      parentTitle,
      parentRatingKey,
      originallyAvailableAt,
      summary,
      children: [
        new Tag({ type: 'Publisher', tag: publisher }),
        ...narrators.map(narrator => new Tag({ type: 'Narrator', tag: narrator }))
      ]
    })]
  })
 res.send(xml( metadata ));
});

app.get('/library/metadata/:ratingKey/images', (req, res) => {
  console.log(`get /images for id: ${req.params.id}`)
  res.send(xml( new MediaContainer({}) ));
});

app.get('/library/metadata/:ratingKey/children', (req, res) => {
  console.log(`get /children for id: ${req.params.id}`)
  res.send(xml( new MediaContainer({}) ));
});

app.post('/library/metadata/matches', async (req, res) => {

  if (req.body.type !== 21){
    console.log('Only book matches are currently supported.');
    return res.send(xml( new MediaContainer({}) ));
  }

  const { parentTitle, title, type } = req.body;
  const audibleMatches = await audible.match({ parentTitle, title, type });
  console.log(audibleMatches);
  const matches = new MediaContainer({
    children: audibleMatches.map(( m, i ) => {
      const { title, parentTitle, ratingKey, parentRatingKey, originallyAvailableAt, thumb, ratingCount } = m;
      return new Directory({
        title,
        parentTitle,
        ratingKey,
        parentRatingKey,
        originallyAvailableAt,
        thumb,
        ratingCount, score: 100 - i * 3 // TODO: Fix scoring.
      });
    })
  })
  res.send(xml( matches ));
});

app.listen(port, () => {
    console.log(`Server started on port ${port}...`);
});
