const fetch = require('node-fetch')

function makeRelativeUrl(url, wordpressUrl) {
  if (url && url.startsWith(wordpressUrl)) {
    return url.replace(wordpressUrl, '')
  }
  return url
}

function rewriteUrls(menuData, wordpressUrl) {
  const result = menuData

  if (result.url) {
    result.url = makeRelativeUrl(result.url, wordpressUrl)
  }

  if (result.buttons) {
    result.buttons.forEach((button) => {
      if (button.link) {
        button.link = makeRelativeUrl(button.link, wordpressUrl)
      }
    })
  }
  if (result.items) {
    result.items.forEach((menuItem) => {
      if (menuItem.url) {
        menuItem.url = makeRelativeUrl(menuItem.url, wordpressUrl)
      }
      if (menuItem.child_items) {
        menuItem.child_items.forEach((childItem) => {
          if (childItem.url) {
            childItem.url = makeRelativeUrl(childItem.url, wordpressUrl)
          }
        })
      }
    })
  }
  return result
}

async function processLocation(location, language, baseUrl, wordpressUrl) {
  const menuTermId = location.menu.term_id
  const urlParams = language !== '*' ? `?wpml_language=${language}` : ''
  const menuUrl = `${baseUrl}/menus/${menuTermId}${urlParams}`
  const result = await fetch(menuUrl)
  const body = await result.json()

  const rewrittenBody = rewriteUrls(body, wordpressUrl)
  return { ...location, menuData: rewrittenBody, language }
}

function createNodeData(location, language, createNodeId, createContentDigest) {
  const nodeId = createNodeId(`wp-menu-location-${location.slug}-term-${location.menu.term_id}`)
  const nodeContent = JSON.stringify(location)
  const nodeData = Object.assign({}, location, {
    id: nodeId,
    parent: null,
    children: [],
    internal: {
      type: `WordpressMenuLocation`,
      content: nodeContent,
      contentDigest: createContentDigest(location),
    },
  })
  return nodeData
}

exports.sourceNodes = async ({ actions, createNodeId, createContentDigest }, configOptions) => {
  const { createNode } = actions
  // Gatsby adds a configOption that's not needed for this plugin, delete it
  delete configOptions.plugins

  let { wordpressUrl, languages, enableWpml } = configOptions

  if (!languages && !enableWpml) {
    languages = ['*']
  }

  const baseUrl = `${wordpressUrl}/wp-json/menus/v1`

  console.log('Querying wordpress menus from ', baseUrl)

  for (const language of languages) {
    // fetch the menu
    let url = `${baseUrl}/locations`
    if (enableWpml) {
      url += `?wpml_language=${language}`
    }
    const result = await fetch(url)
    const locations = await result.json()

    for (const location of Object.keys(locations)) {
      console.log('processing location', location, 'of', url, 'in', language)
      const enhancedLocation = await processLocation(locations[location], language, baseUrl, wordpressUrl)
      // now we have the location plus menu
      const node = createNodeData(enhancedLocation, language, createNodeId, createContentDigest)
      createNode(node)
    }
  }
}
