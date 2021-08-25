export default {
    local: {
        basePath: '/dist/',
        entryPointURL: 'http://127.0.0.1:8000',
        keyCloakBaseURL: 'https://auth-dev.tugraz.at/auth',
        keyCloakRealm: 'tugraz-vpu',
        keyCloakClientId: 'auth-dev-mw-frontend-local',
        matomoUrl: 'https://analytics.tugraz.at/',
        matomoSiteId: 131,
        nextcloudBaseURL: 'http://localhost:8081',
        nextcloudName: 'TU Graz cloud',
        pdfAsQualifiedlySigningServer: 'https://sig-dev.tugraz.at',
        hiddenActivities: [],
    },
    bs: {
        basePath: '/dist/',
        entryPointURL: 'http://bs-local.com:8000',
        keyCloakBaseURL: 'https://auth-test.tugraz.at/auth',
        keyCloakRealm: 'tugraz-vpu',
        keyCloakClientId: 'auth-dev-mw-frontend-local',
        matomoUrl: 'https://analytics.tugraz.at/',
        matomoSiteId: 131,
        nextcloudBaseURL: 'http://bs-local.com:8081',
        nextcloudName: 'TU Graz cloud',
        pdfAsQualifiedlySigningServer: 'https://sig-dev.tugraz.at',
        hiddenActivities: [],
    },
    development: {
        basePath: '/apps/dualdelivery/',
        entryPointURL: 'https://api-dev.tugraz.at',
        keyCloakBaseURL: 'https://auth-dev.tugraz.at/auth',
        keyCloakRealm: 'tugraz-vpu',
        keyCloakClientId: 'dualdelivery-dev_tugraz_at-DUALDELIVERY',
        matomoUrl: 'https://analytics.tugraz.at/',
        matomoSiteId: 131,
        nextcloudBaseURL: 'https://nc-dev.tugraz.at/pers',
        nextcloudName: 'TU Graz cloud',
        pdfAsQualifiedlySigningServer: 'https://sig-dev.tugraz.at',
        hiddenActivities: [],
    },
    demo: {
        basePath: '/apps/dualdelivery/',
        entryPointURL: 'https://api-demo.tugraz.at',
        keyCloakBaseURL: 'https://auth-demo.tugraz.at/auth',
        keyCloakRealm: 'tugraz-vpu',
        keyCloakClientId: 'dbp-dual-delivery',
        matomoUrl: 'https://analytics.tugraz.at/',
        matomoSiteId: 131,
        nextcloudBaseURL: 'https://cloud.tugraz.at',
        nextcloudName: 'TU Graz cloud',
        pdfAsQualifiedlySigningServer: 'https://sig-test.tugraz.at',
        hiddenActivities: [],
    },
    production: {
        basePath: '/',
        entryPointURL: 'https://api.tugraz.at',
        keyCloakBaseURL: 'https://auth.tugraz.at/auth',
        keyCloakRealm: 'tugraz',
        keyCloakClientId: 'dualdelivery_tugraz_at',
        matomoUrl: 'https://analytics.tugraz.at/',
        matomoSiteId: 137,
        nextcloudBaseURL: '',
        nextcloudName: '',
        pdfAsQualifiedlySigningServer: 'https://sig.tugraz.at',
        hiddenActivities: [],
    },
};