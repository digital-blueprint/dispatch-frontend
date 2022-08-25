import {createInstance} from './i18n.js';
import {css, html} from 'lit';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import DBPDispatchLitElement from "./dbp-dispatch-lit-element";
import * as commonUtils from '@dbp-toolkit/common/utils';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {LoadingButton, Icon, MiniSpinner, InlineNotification} from "@dbp-toolkit/common";
import {classMap} from "lit/directives/class-map.js";
import { send } from '@dbp-toolkit/common/notification';
import {Activity} from './activity.js';
import metadata from './dbp-show-requests.metadata.json';

class ShowRequests extends ScopedElementsMixin(DBPDispatchLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.activity = new Activity(metadata);
        this.entryPointUrl = '';
        this.loading = false;
        this._initialFetchDone = false;
        this.requestList = [];
    }

    static get scopedElements() {
        return {
            'dbp-icon': Icon,
            'dbp-mini-spinner': MiniSpinner,
            'dbp-loading-button': LoadingButton,
            'dbp-inline-notification': InlineNotification
        };
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            loading: { type: Boolean, attribute: false },
            initialRequestsLoading: { type: Boolean, attribute: false },
            requestList: { type: Array, attribute: false },
        };
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case 'lang':
                    this._i18n.changeLanguage(this.lang);
                    break;
            }
        });

        super.update(changedProperties);
    }

    editRequest(event, item) {
        console.log("edit pressed");
        // TODO
    }

    deleteRequest(event, item) {
        console.log("delete pressed");
        // TODO
    }

    submitRequest(event, item) {
        console.log("submit pressed");
        // TODO
    }

    parseListOfRequests(response) {
        let list = [];

        let numTypes = parseInt(response['hydra:totalItems']);
        if (isNaN(numTypes)) {
            numTypes = 0;
        }
        for (let i = 0; i < numTypes; i++ ) {
            list[i] = response['hydra:member'][i];
        }
        list.sort(this.compareListItems);

        return list;
    }

    /**
     * Get a list of all requests
     *
     * @returns {Array} list
     */
    async getListOfRequests() {
        this.initialRequestsLoading = !this._initialFetchDone;
        try {
            let response = await this.getListOfDispatchRequests();
            let responseBody = await response.json();
            if (responseBody !== undefined && responseBody.status !== 403) {
                this.requestList = this.parseListOfRequests(responseBody);
            }
        } finally {
            this.initialRequestsLoading = false;
            this._initialFetchDone = true;
        }
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS(false)}
            ${commonStyles.getLinkCss()}
            ${commonStyles.getNotificationCSS()}
            ${commonStyles.getActivityCSS()}

            h3 {
                font-weight: 300;
                margin-top: 1.3em;
                margin-bottom: 1.3em;
            }
            
            .border {
                border-top: var(--dbp-override-border);
            }
            
            .requests {
                margin-top: 1em;
            }
            
            .request-item:first-child {
                border-top: none;
                padding-top: 0;
                margin-top: 0;
            }
            
            .request-item {
                margin: 1.5em 0 1.5em 1em;
            }

            .request-item span:first-child {
                margin-top: 0;
            }

            .request-item span {
                font-weight: 700;
                margin-top: 0.5em;
            }
            
            .sender-data, .files-data, .recipients-data {
                margin: 0.5em 0 0.5em 1em;
            }

            .request-buttons {
                display: flex;
                justify-content: space-between;
                padding-top: 0.5em;
                margin-left: -1em;
            }

            h2:first-child {
                margin-top: 0;
            }

            h2 {
                margin-bottom: 10px;
            }
        `;
    }

    render() {
        const i18n = this._i18n;

        if (this.isLoggedIn() && !this.isLoading() && !this._initialFetchDone && !this.initialRequestsLoading) {
            this.getListOfRequests();
        }

        return html`
            <div class="control ${classMap({hidden: this.isLoggedIn() || !this.isLoading()})}">
                <span class="loading">
                    <dbp-mini-spinner text=${i18n.t('loading-message')}></dbp-mini-spinner>
                </span>
            </div>
            
            <dbp-inline-notification class=" ${classMap({ hidden: this.isLoggedIn() || this.isLoading() })}" 
                            type="warning"
                            body="${i18n.t('error-login-message')}">
            </dbp-inline-notification>

            <div class="${classMap({hidden: !this.isLoggedIn() || this.isLoading()})}">
                
                <h2>${this.activity.getName(this.lang)}</h2>
                <p class="subheadline">
                    <slot name="description">
                        ${this.activity.getDescription(this.lang)}
                    </slot>
                </p>
                
                <slot name="activity-description">
                    <p>${i18n.t('show-requests.description-text')}
                        <a href="#" class="int-link-internal" title="${i18n.t('show-requests.create-new-request')}"
                           @click="${(e) => {
                                this.dispatchEvent(
                                    new CustomEvent('dbp-show-activity', {
                                        detail: {name: 'dispatch-activity'},
                                    })
                                );
                                e.preventDefault();
                           }}"
                        >
                            <span>${i18n.t('show-requests.create-new-request')}.</span>
                        </a>
                    </p>
                </slot>

                <h3>${i18n.t('show-requests.dispatch-orders')}</h3>
                
                <div class="requests ${classMap({hidden: !this.isLoggedIn() || this.isLoading()})}">
                    ${this.requestList.map(i => html`
                        <div class="request-item">
                            <span>${i18n.t('show-requests.id')}:</span> ${i.identifier}<br>
                            <span>${i18n.t('show-requests.date-created')}:</span> ${i.dateCreated}<br>
                            <span>${i18n.t('show-requests.date-submitted')}:</span> 
                                ${i.dateSubmitted ? i.dateSubmitted : i18n.t('show-requests.empty-date-submitted')}<br>
                            
                            <span>${i18n.t('show-requests.sender')}:</span>
                            <div class="sender-data">
                                ${i18n.t('show-requests.sender-family-name')}: ${i.senderFamilyName}<br>
                                ${i18n.t('show-requests.sender-given-name')}: ${i.senderGivenName}<br>
                                ${i18n.t('show-requests.sender-postal-address')}: ${i.senderPostalAddress}
                            </div>

                            <span>${i18n.t('show-requests.files')}:</span>
                            <div class="files-data">
                                ${i.files.map(file => html`
                                    ${file.dispatchRequestIdentifier}<br>
                                `)}
                                 <div class="no-files ${classMap({hidden: !this.isLoggedIn() || i.files.length !== 0})}">${i18n.t('show-requests.empty-files-text')}</div>
                            </div>

                            <span>${i18n.t('show-requests.recipients')}:</span>
                            <div class="recipients-data">
                                ${i.recipients.map(j => html`
                                    ${j.familyName}<br>
                                    ${j.givenName}<br>
                                    <br>
                                `)}
                                <div class="no-recipients ${classMap({hidden: !this.isLoggedIn() || i.recipients.length !== 0})}">${i18n.t('show-requests.no-recipients-text')}</div>
                            </div>
                            
                            <div class="request-buttons">
                                <div class="edit-buttons">
                                    <dbp-loading-button id="edit-btn"
                                                        ?disabled="${this.loading}"
                                                        value="${i18n.t('show-requests.edit-button-text')}" 
                                                        @click="${(event) => { this.editRequest(event, i); }}" 
                                                        title="${i18n.t('show-requests.edit-button-text')}"
                                    >
                                        ${i18n.t('show-requests.edit-button-text')}
                                    </dbp-loading-button>
                                    <dbp-loading-button id="delete-btn" 
                                                        ?disabled="${this.loading}" 
                                                        value="${i18n.t('show-requests.delete-button-text')}" 
                                                        @click="${(event) => { this.deleteRequest(event, i); }}" 
                                                        title="${i18n.t('show-requests.delete-button-text')}"
                                    >
                                        ${i18n.t('show-requests.delete-button-text')}
                                    </dbp-loading-button>
                                </div>
                                <div class="submit-button">
                                    <dbp-loading-button type="is-primary"
                                                        id="submit-btn" 
                                                        ?disabled="${this.loading}" 
                                                        value="${i18n.t('show-requests.submit-button-text')}" 
                                                        @click="${(event) => { this.submitRequest(event, i); }}" 
                                                        title="${i18n.t('show-requests.submit-button-text')}"
                                    >
                                        ${i18n.t('show-requests.submit-button-text')}
                                    </dbp-loading-button>
                                </div>
                            </div>
                        </div>
                        <div class="border">
                    `)}
                    <span class="control ${classMap({hidden: this.isLoggedIn() && !this.initialCheckinsLoading})}">
                        <span class="loading">
                            <dbp-mini-spinner text=${i18n.t('loading-message')}></dbp-mini-spinner>
                        </span>
                    </span>
                    
                    <div class="no-requests ${classMap({hidden: !this.isLoggedIn() || this.initialRequestsLoading || this.requestList.length !== 0})}">${i18n.t('show-requests.no-requests-message')}</div>
                
                </div>
                
<!--                <div class="border"></div>-->
                
                <!-- <dbp-loading-button type="is-primary" 
                                    id="edit-btn" 
                                    ?disabled="${this.loading}" 
                                    value="${i18n.t('show-requests.create-new-request')}"
                                    @click="${(event) => { this.createNewRequest(event); }}"
                                    title="${i18n.t('show-requests.create-new-request')}"
                >${i18n.t('show-requests.create-new-request')}</dbp-loading-button>
                -->
                
            </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-show-requests', ShowRequests);
