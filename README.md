# Dispatch Application

[GitLab Repository](https://gitlab.tugraz.at/dbp/dual-delivery/dispatch) |
[npmjs package](https://www.npmjs.com/package/@dbp-topics/dispatch) |
[Unpkg CDN](https://unpkg.com/browse/@dbp-topics/dispatch/) |
[Dispatch Bundle](https://gitlab.tugraz.at/dbp/dual-delivery/api-dual-delivery-bundle)

TODO: Dispatch description

## Prerequisites

- You need the [API server](https://gitlab.tugraz.at/dbp/relay/dbp-relay-server-template) running
- You need the [DBP Dispatch Bundle](https://gitlab.tugraz.at/dbp/dual-delivery/dbp-relay-dispatch-bundle)

## Local development

```bash
# get the source
git clone git@gitlab.tugraz.at:dbp/dual-delivery/dispatch.git
cd dispatch
git submodule update --init

# install dependencies
yarn install

# constantly build dist/bundle.js and run a local web-server on port 8001 
yarn run watch

# run tests
yarn test
```

Jump to <http://localhost:8001> and you should get a Single Sign On login page.

To use the Nextcloud functionality you need a running Nextcloud server with the
[webapppassword](https://gitlab.tugraz.at/dbp/nextcloud/webapppassword) Nextcloud app like this
[Nextcloud Development Environment](https://gitlab.tugraz.at/dbp/nextcloud/webapppassword/-/tree/master/docker).

## Using this app as pre-built package

### Install app

If you want to install the dbp dispatch app in a new folder `dispatch-app` with a path prefix `/` you can call:

```bash
npx @digital-blueprint/cli@latest install-app dispatch dispatch-app /
```

Afterwards you can point your Apache web-server to `dispatch-app/public`.

Make sure you are allowing `.htaccess` files in your Apache configuration.

Also make sure to add all of your resources you are using (like your API and Keycloak servers) to the
`Content-Security-Policy` in your `dispatch-app/public/.htaccess`, so the browser allows access to those sites.

You can also use this app directly from the [Unpkg CDN](https://unpkg.com/browse/@dbp-topics/dispatch/)
for example like this: [dbp-dispatch/index.html](https://gitlab.tugraz.at/dbp/dual-delivery/dispatch/-/tree/main/examples/dbp-dispatch/index.html)

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.

### Update app

If you want to update the dbp dispatch app in the current folder you can call:

```bash
npx @digital-blueprint/cli@latest update-app dispatch
```

## Using a single activity as pre-built package

You can also use a single activity directly from the [Unpkg CDN](https://unpkg.com/browse/@dbp-topics/dispatch/)
for example the `dbp-qualified-dispatch-pdf-upload` activity to qualifiedly sign PDF documents like this:
[dbp-qualified-dispatch-pdf-upload/index.html](https://gitlab.tugraz.at/dbp/dual-delivery/dispatch/-/tree/main/examples/dbp-qualified-dispatch-pdf-upload/index.html)

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.

## Activities

This app has the following activities:
- `dbp-dd-activity`
- `dbp-qualified-signature-pdf-upload`
- `dbp-official-signature-pdf-upload`

You can find the documentation of these activities in the [qualified dispatch activities documentation](https://gitlab.tugraz.at/dbp/dual-delivery/dispatch/-/tree/main/src).

## Adapt app

### Functionality

You can add multiple attributes to the `<dbp-greenlight>` tag.

| attribute name | value | Link to description |
|----------------|-------| ------------|
| `provider-root` | Boolean | [app-shell](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/main/packages/app-shell#attributes) |
| `lang`         | String | [language-select](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/main/packages/language-select#attributes) | 
| `entry-point-url` | String | [app-shell](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/main/packages/app-shell#attributes) |
| `keycloak-config` | Object | [app-shell](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/main/packages/app-shell#attributes) |
| `base-path` | String | [app-shell](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/main/packages/app-shell#attributes) |
| `src` | String | [app-shell](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/main/packages/app-shell#attributes) |
| `html-overrides` | String | [common](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/main/packages/common#overriding-slots-in-nested-web-components) |
| `themes` | Array | [theme-switcher](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/main/packages/theme-switcher#themes-attribute) |
| `darkModeThemeOverride` | String | [theme-switcher](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/main/packages/theme-switcher#themes-attribute) |

#### Mandatory attributes

If you are not using the `provider-root` attribute to "terminate" all provider attributes
you need to manually add these attributes so that the topic will work properly:

```html
<dbp-dispatch
        auth
        requested-login-status
        analytics-event
        initial-file-handling-state
        clipboard-files
>
</dbp-dispatch>
```

### Design

For frontend design customizations, such as logo, colors, font, favicon, and more, take a look at the [theming documentation](https://dbp-demo.tugraz.at/dev-guide/frontend/theming/).

## "dbp-dispatch" slots

These are common slots for the app-shell. You can find the documentation of these slots in the [app-shell documentation](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/main/packages/app-shell).
For the app specific slots take a look at the [greenlight activities](https://gitlab.tugraz.at/dbp/dual-delivery/dispatch/-/tree/main/src).
