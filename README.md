# Gatsby source wordpress menus

## Description

this is a gatsby source plugin to read wordpress menus via the REST API
and make its contents available via GraphQL.
It specifically supports WPML. If you are not using WPML then there are usually
better ways to get at this data (e.g. via GraphQL or `gatsby-source-wordpress`).

Unfortunately support for additional query parameters or route modification are still not supported
in gatsby.

- https://github.com/gatsbyjs/gatsby/pull/10942
- https://github.com/gatsbyjs/gatsby/issues/17943
- https://github.com/gatsbyjs/gatsby/pull/19144

## Dependencies

You need the following wordpress plugin installed in your wordpress instance

https://wordpress.org/plugins/wp-rest-api-v2-menus/

## How to install

```bash
yarn install gatsby-source-wordpress-menus
```

in your `gatsby-config.js`

```javascript
module.exports = {
  siteMetadata: {
    ...
  },
  plugins: [
    ...
    {
      resolve: "gatsby-source-wordpress-menus",
      options: {
        wordpressUrl: "https://your-wordpress-site.com",
        languages: ["de", "en"],
        enableWpml: true,
      },
    },
    ...
```

## Examples of usage

You can now query your menu data via

```graphql
query MyQuery {
  wordpressMenuLocation(slug: { eq: "location-slug" }, language: { eq: "en" }) {
    slug
    language
    menu {
      filter
      name
      slug
      taxonomy
    }
    menuData {
      items {
        menu_order
        slug
        title
        url
        child_items {
          title
          url
          type
        }
      }
    }
  }
  allWordpressMenuLocation {
    nodes {
      id
      slug
      language
      menu {
        slug
        taxonomy
        errors {
          invalid_term
        }
      }
    }
  }
}
```

## How to contribute

Any contribution, feedback and PRs are very welcome. Issues is a preferred way of submitting feedback.
