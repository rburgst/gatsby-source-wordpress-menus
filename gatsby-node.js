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

async function processLocation(cache, doAllowCache, location, language, baseUrl, wordpressUrl, reporter) {
  const menuTermId = location.menu.term_id
  const urlParams = language !== '*' ? `?wpml_language=${language}` : ''
  const menuUrl = `${baseUrl}/menus/${menuTermId}${urlParams}`

  let body = await getCachedOrFetch(cache, doAllowCache, menuUrl, reporter)

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

async function getCachedOrFetch(cache, doAllowCache, url, reporter, doSetCacheTimestamp = false) {
  let locations = doAllowCache && await cache.get(url)
  if (!locations) {
    const result = await fetch(url)
    locations = await result.json()
    await cache.set(url, locations)
    if (doSetCacheTimestamp) {
      await cache.set("cacheTime", new Date().toISOString())
    }
  } else {
    reporter.info(`  got ${url} from cache`)
  }
  return locations
}

exports.sourceNodes = async ({ actions, getCache, createNodeId, createContentDigest, reporter }, configOptions) => {
  const { createNode } = actions
  // Gatsby adds a configOption that's not needed for this plugin, delete it
  delete configOptions.plugins

  let { wordpressUrl, languages, enableWpml, allowCache = true, maxCacheDurationSeconds = 60 * 60 * 24 } = configOptions

  if (!languages && !enableWpml) {
    languages = ['*']
  }

  const baseUrl = `${wordpressUrl}/wp-json/menus/v1`
  const cache = getCache('gatsby-source-wordpress-menus')

  let doAllowCache = allowCache
  if (allowCache) {
    const cacheTimestamp = cache.get('cacheTime')
    if (cacheTimestamp) {
      const cacheDate = new Date(cacheTimestamp)
      const cacheMillis = cacheDate.getTime()
      const ageInMillis = Date.now() - cacheMillis
      doAllowCache = ageInMillis < (maxCacheDurationSeconds * 1000)
    }
  }

  reporter.info(`Querying wordpress menus from ${baseUrl}, cache allowed ${doAllowCache}`)

  for (const language of languages) {
    // fetch the menu
    let url = `${baseUrl}/locations`
    if (enableWpml) {
      url += `?wpml_language=${language}`
    }
    let locations = await getCachedOrFetch(cache, doAllowCache, url, reporter, true)

    for (const location of Object.keys(locations)) {
      reporter.verbose(`processing location ${location} of  ${url} in language ${language}`)
      const enhancedLocation = await processLocation(cache, doAllowCache, locations[location], language, baseUrl, wordpressUrl, reporter)
      // now we have the location plus menu
      const node = createNodeData(enhancedLocation, language, createNodeId, createContentDigest)
      createNode(node)
    }
  }
}
