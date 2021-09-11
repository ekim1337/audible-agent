const esc = require('xml-escape');
const moment = require ('moment');
const striptags = require('striptags');

const AGENT_IDENTIFIER = 'tv.plex.agents.custom.audible';

class MediaProvider {
  constructor({ title, features }) {
    this.elements = [{
      type: 'element',
      name: 'MediaProvider',
      attributes: { identifier: AGENT_IDENTIFIER, title },
      elements: features.map(feature => {
        const { type, key } = feature;
        return({
          type: 'element',
          name: 'Feature',
          attributes: { type, key }
        })
      })
    }];
  }
}

class MediaContainer {
  constructor({ children = [] }) {
    this.elements = [{
      type: 'element',
      name: 'MediaContainer',
      attributes: { offset: 0, size: children.length, totalSize: children.length },
      elements: children
    }];
  }
}

class Directory {
  constructor({ title, ratingKey, thumb, parentTitle, parentRatingKey, parentThumb, originallyAvailableAt, summary, ratingCount, score, children = [] }) {
    const type = !!parentRatingKey ? 'audiobook' : 'author';
    const parentType = !!parentRatingKey ? 'author' : null;
    this.type = 'element';
    this.name = 'Directory';
    this.attributes = {
      title: esc(title),
      type,
      parentTitle: esc(parentTitle),
      parentType,
      ratingKey,
      parentRatingKey,
      guid: `${AGENT_IDENTIFIER}://${type}/${ratingKey}`,
      parentGuid: !!parentType ? `${AGENT_IDENTIFIER}://${parentType}/${parentRatingKey}` : null,
      key: `/library/metadata/${ratingKey}/children`,
      thumb,
      parentThumb,
      originallyAvailableAt,
      year: !!originallyAvailableAt ? moment(originallyAvailableAt).format('YYYY') : null,
      summary: esc(striptags(summary)),
      ratingCount,
      score
    };
    this.elements = children;
  }
}

class Tag {
  constructor({ type, tag }) {
    this.type = 'element';
    this.name = type;
    this.attributes = { tag: esc(tag) }
  }
}

module.exports = { MediaProvider, MediaContainer, Directory, Tag }
