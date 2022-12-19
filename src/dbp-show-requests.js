import {createInstance} from './i18n.js';
import {css, unsafeCSS, html} from 'lit';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import DBPDispatchLitElement from "./dbp-dispatch-lit-element";
import * as commonUtils from '@dbp-toolkit/common/utils';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {LoadingButton, IconButton, Icon, MiniSpinner, InlineNotification, getIconSVGURL} from "@dbp-toolkit/common";
import {classMap} from "lit/directives/class-map.js";
import {Activity} from './activity.js';
import metadata from './dbp-show-requests.metadata.json';
import MicroModal from './micromodal.es';
import {FileSource} from '@dbp-toolkit/file-handling';
import {TabulatorFull as Tabulator} from 'tabulator-tables';
import * as dispatchStyles from './styles';
import {name as pkgName} from './../package.json';
import {humanFileSize} from '@dbp-toolkit/common/i18next';
import * as dispatchHelper from "./utils";
import {PersonSelect} from "@dbp-toolkit/person-select";
import {ResourceSelect} from "@dbp-toolkit/resource-select";
import {InfoTooltip} from "@dbp-toolkit/tooltip";

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
        this.showListView = true;
        this.showDetailsView = false;

        this.currentItem = {};

        this.currentItem.files = [];
        this.currentItem.recipients = [];

        this.currentRecipient = {};
        this.subject = '';
        this.mayWrite = false;
        this.mayRead = false;
        this.organizationSet = false;

        this.currentItem.senderGivenName = "";
        this.currentItem.senderFamilyName = "";
        this.currentItem.senderAddressCountry = "";
        this.currentItem.senderPostalCode = "";
        this.currentItem.senderAddressLocality = "";
        this.currentItem.senderStreetAddress = "";
        this.currentItem.senderBuildingNumber = "";

        this.fileHandlingEnabledTargets = "local";
        this.nextcloudWebAppPasswordURL = "";
        this.nextcloudWebDavURL = "";
        this.nextcloudName = "";
        this.nextcloudFileURL = "";
        this.nextcloudAuthInfo = "";

        this.dispatchRequestsTable = null;
        this.totalNumberOfItems = 0;
        this.rowsSelected = false;

        this.boundSelectHandler = this.selectAllFiles.bind(this);

        this.initateOpenAdditionalMenu = false;
        this.initateOpenAdditionalSearchMenu = false;
        // this.boundCloseAdditionalMenuHandler = this.hideAdditionalMenu.bind(this);
        this.boundCloseAdditionalSearchMenuHandler = this.hideAdditionalSearchMenu.bind(this);
        this.boundPressEnterAndSubmitSearchHandler = this.pressEnterAndSubmitSearch.bind(this);
    }

    static get scopedElements() {
        return {
            'dbp-icon': Icon,
            'dbp-mini-spinner': MiniSpinner,
            'dbp-loading-button': LoadingButton,
            'dbp-icon-button': IconButton,
            'dbp-inline-notification': InlineNotification,
            'dbp-file-source': FileSource,
            'dbp-person-select': PersonSelect,
            'dbp-resource-select': ResourceSelect,
            'dbp-info-tooltip': InfoTooltip
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
            showListView: { type: Boolean, attribute: false },
            showDetailsView: { type: Boolean, attribute: false },
            currentItem: { type: Object, attribute: false },
            currentRecipient: { type: Object, attribute: false },
            totalNumberOfItems: { type: Number, attribute: false },
            subject: { type: String, attribute: false },
            organizationSet: { type: Boolean, attribute: false },
            mayWrite: { type: Boolean, attribute: false },
            mayRead: { type: Boolean, attribute: false },
            rowsSelected: { type: Boolean, attribute: false },

            fileHandlingEnabledTargets: {type: String, attribute: 'file-handling-enabled-targets'},
            nextcloudWebAppPasswordURL: {type: String, attribute: 'nextcloud-web-app-password-url'},
            nextcloudWebDavURL: {type: String, attribute: 'nextcloud-webdav-url'},
            nextcloudName: {type: String, attribute: 'nextcloud-name'},
            nextcloudFileURL: {type: String, attribute: 'nextcloud-file-url'},
            nextcloudAuthInfo: {type: String, attribute: 'nextcloud-auth-info'},
        };
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case 'lang':
                    this._i18n.changeLanguage(this.lang);
                    if (this.dispatchRequestsTable) {
                        this.dispatchRequestsTable.setLocale(this.lang);
                    }
                    break;
            }
        });

        super.update(changedProperties);
    }

    disconnectedCallback() {
        this.dispatchRequestsTable.off("rowClick");
        this.dispatchRequestsTable.off("dataLoaded");
        this.dispatchRequestsTable.off("pageLoaded");

        document.removeEventListener('keyup', this.boundPressEnterAndSubmitSearchHandler);

        super.disconnectedCallback();
    }

    connectedCallback() {
        super.connectedCallback();
        this._loginStatus = '';
        this._loginState = [];
        this._loginCalled = false;

        this.updateComplete.then(() => {
            let paginationElement = this._('.tabulator-paginator');

            const i18n = this._i18n;
            const that = this;

            // see: http://tabulator.info/docs/5.1
            this.dispatchRequestsTable = new Tabulator(this._('#dispatch-requests-table'), {
                layout: 'fitColumns',
                placeholder: i18n.t('show-requests.no-table-data'),
                selectable: true,
                selectablePersistence: false, // disable persistent selections
                responsiveLayout: 'collapse',
                responsiveLayoutCollapseStartOpen: false,
                pagination: 'local',
                paginationSize: 10,
                paginationSizeSelector: true,
                paginationElement: paginationElement,
                columnHeaderVertAlign: 'bottom', // align header contents to bottom of cell
                columnDefaults: {
                    vertAlign: 'middle',
                    hozAlign: 'left',
                    resizable: false,
                },
                columns: [
                    {
                        title:
                            '<label id="select_all_wrapper" class="button-container select-all-icon">' +
                            '<input type="checkbox" id="select_all" name="select_all" value="select_all">' +
                            '<span class="checkmark" id="select_all_checkmark"></span>' +
                            '</label>',

                        field: 'type',
                        hozAlign: 'center',
                        width: 40,
                        headerSort: false,
                        responsive: 0,
                        widthGrow: 1,
                        headerClick: (e) => {
                            let allSelected = that.checkAllSelected();

                            if (allSelected) {
                                // that.dispatchRequestsTable.deselectRow("visible"));
                                this.dispatchRequestsTable.deselectRow();
                                this._('#select_all').checked = false;
                            } else {
                                that.dispatchRequestsTable.selectRow("visible");
                                this._('#select_all').checked = true;
                            }
                            e.preventDefault();
                        },
                    },
                    {
                        title: i18n.t('show-requests.table-header-details'),
                        field: 'details',
                        hozAlign: 'center',
                        width: 60,
                        headerSort: false,
                        responsive: 0,
                        widthGrow: 1,
                        formatter: 'responsiveCollapse'
                    },
                    {
                        title: i18n.t('show-requests.table-header-date-created'),
                        field: 'dateCreated',
                        responsive: 3,
                        widthGrow: 1,
                        minWidth: 160,
                        sorter: (a, b) => {
                            const a_timestamp = Date.parse(a);
                            const b_timestamp = Date.parse(b);
                            return a_timestamp - b_timestamp;
                        },
                        formatter: function (cell) {
                            const d = Date.parse(cell.getValue());
                            const timestamp = new Date(d);
                            const year = timestamp.getFullYear();
                            const month = ('0' + (timestamp.getMonth() + 1)).slice(-2);
                            const date = ('0' + timestamp.getDate()).slice(-2);
                            const hours = ('0' + timestamp.getHours()).slice(-2);
                            const minutes = ('0' + timestamp.getMinutes()).slice(-2);
                            return date + '.' + month + '.' + year + ' ' + hours + ':' + minutes;
                        },
                    },
                    {
                        title: i18n.t('show-requests.table-header-subject'),
                        field: 'subject',
                        responsive: 1,
                        widthGrow: 3,
                        minWidth: 150,
                        formatter: 'html'
                    },
                    {
                        title: 'Status',
                        field: 'status',
                        responsive: 2,
                        widthGrow: 1,
                        minWidth: 120,
                    },
                    // {
                    //     title: i18n.t('show-requests.table-header-sender'),
                    //     field: 'sender',
                    //     // visible: false,
                    //     responsive: 8,
                    //     minWidth: 800,
                    //     formatter: function(cell) {
                    //         let value = cell.getValue();
                    //         return value;
                    //     }
                    // },
                    {
                        title: i18n.t('show-requests.table-header-files'),
                        field: 'files',
                        // visible: false,
                        responsive: 8,
                        minWidth: 800,
                        formatter: function(cell) {
                            let value = cell.getValue();
                            return value;
                        }
                    },
                    {
                        title: i18n.t('show-requests.table-header-recipients'),
                        field: 'recipients',
                        // visible: false,
                        responsive: 8,
                        minWidth: 800,
                        formatter: function(cell) {
                            let value = cell.getValue();
                            return value;
                        }
                    },
                    {
                        title: i18n.t('show-requests.date-submitted'),
                        field: 'dateSubmitted',
                        responsive: 8,
                        minwidth: 150,
                        formatter: function(cell) {
                            let value = cell.getValue();
                            return value;
                        }
                    },
                    {
                        title: i18n.t('show-requests.table-header-id'),
                        field: 'requestId',
                        responsive: 8,
                        minWidth: 150,
                        formatter: function(cell) {
                            let value = cell.getValue();
                            return value;
                        }
                    },
                    {
                        title: '',
                        field: 'controls',
                        // hozAlign: 'center',
                        minWidth: 140,
                        widthGrow: 1,
                        headerSort: false,
                        responsive: 0,
                        formatter: (cell) => {
                            let value = cell.getValue();
                            return value;
                        },
                    },
                ],
                langs: {
                    'en': {
                        'columns': {
                            'dateCreated': 'Date created',
                            'subject': 'Subject',
                            // 'sender': 'Sender',
                            'files': 'Files',
                            'recipients': 'Recipients',
                            'dateSubmitted': 'Date submitted',
                            'requestId': 'Request-ID'
                        },
                        'pagination': {
                            'page_size': 'Page size',
                            'page_size_title': 'Page size',
                            'first': '<span class="mobile-hidden">First</span>',
                            'first_title': 'First Page',
                            'last': '<span class="mobile-hidden">Last</span>',
                            'last_title': 'Last Page',
                            'prev': '<span class="mobile-hidden">Prev</span>',
                            'prev_title': 'Prev Page',
                            'next': '<span class="mobile-hidden">Next</span>',
                            'next_title': 'Next Page'
                        }
                    },
                    'de': {
                        'columns': {
                            'dateCreated': 'Erstelldatum',
                            'subject': 'Betreff',
                            // 'sender': 'Absender',
                            'files': 'Angehängte Dateien',
                            'recipients': 'Empfänger',
                            'dateSubmitted': 'Freigabedatum',
                            'requestId': 'Auftrags-ID'
                        },
                        'pagination': {
                            'page_size': 'Einträge pro Seite',
                            'page_size_title': 'Einträge pro Seite',
                            'first': '<span class="mobile-hidden">Erste</span>',
                            'first_title': 'Erste Seite',
                            'last': '<span class="mobile-hidden">Letzte</span>',
                            'last_title': 'Letzte Seite',
                            'prev': '<span class="mobile-hidden">Vorherige</span>',
                            'prev_title': 'Vorherige Seite',
                            'next': '<span class="mobile-hidden">Nächste</span>',
                            'next_title': 'Nächste Seite'
                        }
                    }
                },
                initialSort: [
                    { column: 'dateCreated', dir: 'desc' },
                    // { column: 'status', dir: 'desc' },
                ],
            });

            this.dispatchRequestsTable.on("rowClick", this.rowClickFunction.bind(this));
            //this.dispatchRequestsTable.on("rowAdded", this.rowAddedFunction.bind(this));
            this.dispatchRequestsTable.on("dataLoaded", this.dataLoadedFunction.bind(this));
            this.dispatchRequestsTable.on("pageLoaded", this.pageLoadedFunction.bind(this));

            document.addEventListener('keyup', this.boundPressEnterAndSubmitSearchHandler);
        });
    }

    pageLoadedFunction(currentPageNumber) {
        this._('#select_all').checked = false;
    }

    dataLoadedFunction(data) {
        if (this.dispatchRequestsTable !== null) {
            const that = this;
            setTimeout(function () {
                if (that._('.tabulator-responsive-collapse-toggle-open')) {
                    that._a('.tabulator-responsive-collapse-toggle-open').forEach(
                        (element) =>
                            element.addEventListener('click', that.toggleCollapse.bind(that))
                    );
                }

                if (that._('.tabulator-responsive-collapse-toggle-close')) {
                    that._a('.tabulator-responsive-collapse-toggle-close').forEach(
                        (element) =>
                            element.addEventListener('click', that.toggleCollapse.bind(that))
                    );
                }

            }, 0);
        }
    }

    toggleCollapse(e) {
        const table = this.dispatchRequestsTable;
        // give a chance to draw the table
        // this is for getting more height in tabulator table, when toggle is called

        console.log(e);

        // const that = this;

        setTimeout(function () {
            // table.toggleColumn('sender');
            // table.toggleColumn('files');
            // table.toggleColumn('recipients');

            // if (table && that._('.tabulator-responsive-collapse-toggle')) {
            //     that._a('.tabulator-responsive-collapse-toggle').forEach((element) => {
            //         element.classList.toggle('dbp-open');
            //         console.log(e);
            //     });
            // }

            table.redraw();
        }, 0);
    }

    rowClickFunction(e, row) {
        if (
            this.dispatchRequestsTable !== null &&
            this.dispatchRequestsTable.getSelectedRows().length ===
            this.dispatchRequestsTable.getRows("visible").length) {
                this._('#select_all').checked = true;
        } else {
                this._('#select_all').checked = false;
        }
        if (
            this.dispatchRequestsTable !== null &&
            this.dispatchRequestsTable.getSelectedRows().length > 0 ) {
            this.rowsSelected = true;
        } else {
            this.rowsSelected = false;
        }
    }

    /**
     * Select or deselect all files from tabulator table
     *
     */
    selectAllFiles() {
        let allSelected = this.checkAllSelected();

        if (allSelected) {
            this.dispatchRequestsTable.getSelectedRows().forEach((row) => row.deselect());
        } else {
            this.dispatchRequestsTable.getRows().forEach((row) => row.select());
            // this.dispatchRequestsTable.selectRow();
        }
    }

    checkAllSelected() {
        if (this.dispatchRequestsTable) {
            let maxSelected = this.dispatchRequestsTable.getRows("visible").length;
            let selected = this.dispatchRequestsTable.getSelectedRows().length;
            // console.log('currently visible: ', this.dispatchRequestsTable.getRows("visible").length);
            // console.log('currently selected: ', this.dispatchRequestsTable.getSelectedRows().length);

            if (selected === maxSelected) {
                return true;
            }
        }
        return false;
    }

    /**
     * Keydown Event function if enter pressed, then start filtering the table
     *
     * @param event
     */
    pressEnterAndSubmitSearch(event) {
        if (event.keyCode === 13) {
            console.log('enter detected');
            const activeElement = this.shadowRoot.activeElement;
            if (activeElement && activeElement.id === 'searchbar') {
                event.preventDefault();
                this.filterTable();
                this.hideAdditionalSearchMenu(event);
            }
        }
    }

    /*
     * Clear Filer
     */
    clearFilter() {
        let filter = this._('#searchbar');
        let search = this._('#search-select');

        if (!filter || !search || !this.dispatchRequestsTable)
            return;

        filter.value = '';
        search.value = 'all';
        this.dispatchRequestsTable.clearFilter();
        this.totalNumberOfItems = this.dispatchRequestsTable.getDataCount("active");
    }

    /**
     * Function for filtering table
     *
     */
    filterTable() {
        let filter = this._('#searchbar');
        let search = this._('#search-select');
        let operator = this._('#search-operator');

        if (!filter || !operator || !search || !this.dispatchRequestsTable)
            return;

        if (filter.value === "") {
            this.dispatchRequestsTable.clearFilter();
            this.totalNumberOfItems = this.dispatchRequestsTable.getDataCount("active");
            return;
        }
        filter = filter.value;
        search = search.value;
        operator = operator.value;

        if (search !== 'all') {
            this.dispatchRequestsTable.setFilter(search, operator, filter);
            return;
        }

        let filterArray = [];
        this.dispatchRequestsTable.getColumns().forEach((col) => {
            let field = col.getDefinition().field;
            filterArray.push({field: field, type: operator, value: filter});
        });

        this.dispatchRequestsTable.setFilter([filterArray]);
        this.totalNumberOfItems = this.dispatchRequestsTable.getDataCount("active");
    }

    /**
     * Toggle additional functionalities menu on mobile
     *
     */
    toggleMoreMenu() {
        const menu = this.shadowRoot.querySelector('ul.extended-menu');
        const menuStart = this.shadowRoot.querySelector('a.extended-menu-link');

        if (menu === null || menuStart === null) {
            return;
        }

        menu.classList.toggle('hidden');

        if (!menu.classList.contains('hidden')) {
            // add event listener for clicking outside of menu
            document.addEventListener('click', this.boundCloseAdditionalMenuHandler);
            this.initateOpenAdditionalMenu = true;
        } else {
            document.removeEventListener('click', this.boundCloseAdditionalMenuHandler);
        }
    }

    /**
     * Hide additional functionalities menu
     * This function is used as bounded event function,
     * if clicked outside then we can close the menu
     *
     */
    hideAdditionalMenu() {
        if (this.initateOpenAdditionalMenu) {
            this.initateOpenAdditionalMenu = false;
            return;
        }
        const menu = this.shadowRoot.querySelector('ul.extended-menu');
        if (menu && !menu.classList.contains('hidden')) {
            this.toggleMoreMenu();
        }
    }

    /**
     * Toggle search menu
     *
     */
    toggleSearchMenu() {
        const menu = this._('#extendable-searchbar .extended-menu');

        if (menu === null) {
            return;
        }

        menu.classList.remove('hidden');

        if (!menu.classList.contains('hidden')) {
            // add event listener for clicking outside of menu
            document.addEventListener('click', this.boundCloseAdditionalSearchMenuHandler);
            this.initateOpenAdditionalSearchMenu = true;
        }
    }

    /**
     * hide search menu
     *
     * @param e
     */
    hideAdditionalSearchMenu(e) {
        if (this.initateOpenAdditionalSearchMenu) {
            this.initateOpenAdditionalSearchMenu = false;
            return;
        }

        if (e.type !== 'keyup' && e.keyCode !== 13
            && e.originalTarget && e.originalTarget.parentElement
            && (e.originalTarget.parentElement.classList.contains('extended-menu')
            || e.originalTarget.parentElement.id === 'search-operator')
            || (e.originalTarget && e.originalTarget.parentElement && e.originalTarget.parentElement.id === 'search-select')
            || e.originalTarget && e.originalTarget.id === 'searchbar-menu'
            || e.originalTarget && e.originalTarget.id === 'searchbar') {
            return;
        }

        const menu = this._('#extendable-searchbar .extended-menu');
        if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
            document.removeEventListener('click', this.boundCloseAdditionalSearchMenuHandler);
        }
    }

    /**
     * Creates options for a select box of the t
     * this.submissionColumns Array (all possible cols of active table)
     *
     * @returns {Array<html>} options
     */
    getTableHeaderOptions() {
        const i18n = this._i18n;
        if (!this.dispatchRequestsTable)
            return;

        let options = [];
        options[0] = html`<option value='all'>${i18n.t('show-requests.all-columns')}</option>`;

        this.dispatchRequestsTable.getColumns().forEach((col, counter) => {
            let name = col.getDefinition().title;
            let field = col.getDefinition().field;
            if (field && !field.includes('no_display') && field !== 'details' && field !== 'requestId' && field !== 'type' && field !== 'controls') {
                options[counter + 1] = html`<option value='${field}'>${name}</option>`;
            }
        });

        return options;
    }

    processSelectedOrganization(event) {
        this.groupId = event.target.valueObject.identifier;
        this.mayWrite = event.target.valueObject.mayWrite;
        this.mayRead = event.target.valueObject.mayRead;
        // console.log('write: ', this.mayWrite);
        // console.log('read: ', this.mayRead);
        this.organizationSet = true;
        this.getListOfRequests();
    }

    static get styles() {
        // language=css
        // noinspection CssUnresolvedCustomProperty
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS(false)}
            ${commonStyles.getLinkCss()}
            ${commonStyles.getNotificationCSS()}
            ${commonStyles.getActivityCSS()}
            ${commonStyles.getModalDialogCSS()}
            ${commonStyles.getButtonCSS()}
            ${commonStyles.getTabulatorStyles()}
            /*${commonStyles.getRadioAndCheckboxCss()}*/
            ${dispatchStyles.getShowDispatchRequestsCss()}
            ${dispatchStyles.getDispatchRequestStyles()}
            
            .tabulator .tabulator-placeholder-contents {
                margin-bottom: auto;
            }
            
            .control.table {
                padding-top: 1.5rem;
                font-size: 1.5rem;
                text-align: center;
            }
            
            .muted {
                color: var(--dbp-muted);
            }

            #search-operator, #search-select, .dropdown-menu {
                background-color: var(--dbp-secondary-surface);
                color: var(--dbp-on-secondary-surface);
                border-color: var(--dbp-secondary-surface-border-color);
                background-size: auto 45%;
                padding-bottom: calc(0.375em - 1px);
                padding-left: 0.75em;
                padding-right: 1.5rem;
                padding-top: calc(0.375em - 1px);
                cursor: pointer;
                background-position-x: calc(100% - 0.4rem);
                box-sizing: content-box;
            }

            #search-select, #search-operator {
                margin-bottom: 10px;
                box-sizing: border-box;
                text-align: left;
            }

            .extended-menu.hidden {
                display: none !important;
            }

            #extendable-searchbar .extended-menu {
                list-style: none;
                border: var(--dbp-border);
                background-color: var(--dbp-background);
                z-index: 1000;
                border-radius: var(--dbp-border-radius);
                width: 100%;
                position: absolute;
                right: 0px;
                background-color: var(--dbp-background);
                padding: 10px;
                box-sizing: border-box;
                top: 33px;
                margin: 0px;
                border-top: unset;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            
            
            .tabulator-icon-buttons {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.5rem;
            }

            .search-wrapper {
                display: flex;
                justify-content: center;
                min-width: 300px;
            }
            
            .table-wrapper {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .tabulator-responsive-collapse table tr td:first-child {
                width: 4em;
            }
            
            #extendable-searchbar {
                display: flex;
                flex-grow: 1;
                position: relative;
                width: 320px;
            }
            
            #searchbar {
                width: 100%;
                box-sizing: border-box;
                border: var(--dbp-border);
                padding: calc(0.375em - 1px) 10px;
                border-radius: var(--dbp-border-radius);
                min-height: 33px;
                background-color: var(--dbp-background);
                color: var(--dbp-content);
            }
            
            #search-button {
                margin-left: -40px;
                font-size: 1rem;
            }

            .edit-items {
                font-size: 1.6rem;
            }
            
            .tabulator-row, .tabulator-row.tabulator-row-even, .tabulator-row.tabulator-row-odd {
                margin-bottom: 1rem;
                border: 1px solid var(--dbp-override-muted);
                min-height: 65px;
            }
            
            .tabulator-cell {
                height: 65px;
            }

            a {
                color: var(--dbp-override-content);
                cursor: pointer;
                text-decoration: none;
            }

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
            
            .sender-data {
                /*margin: 0.5em 0 0.5em 16px;*/
                margin: 0 0 0.5em 1px;
                line-height: 1.5;
            }

            .tabulator .tabulator-footer .tabulator-paginator .tabulator-page[disabled] {
                opacity: 0.4;
            }
            
            .tabulator .tabulator-footer .tabulator-page {
                display: inline-block;
                margin: 0 2px;
                padding: 2px 5px;
                border: 1px solid #aaa;
                border-radius: 3px;
                background: hsla(0,0%,100%,.2);
            }

            .tabulator-cell[tabulator-field=controls] {
                justify-content: flex-end!important;
            }
            
            .tabulator .tabulator-header .tabulator-col.tabulator-sortable .tabulator-col-content .tabulator-col-sorter {
                position: unset;
            }
            
            .tabulator .tabulator-header .tabulator-col.tabulator-sortable .tabulator-col-content .tabulator-col-title-holder {
                display: inline-flex;
            }
            
            #search-button dbp-icon {
                top: -4px;
            }
            
            #open-settings-btn dbp-icon,
            .card .button.is-icon dbp-icon,
            .header-btn .button.is-icon dbp-icon {
                font-size: 1.3em;
            }
            
            @media only screen and (orientation: portrait) and (max-width: 768px) {
                
                #searchbar {
                    width: 100%;
                    height: 40px;
                }
                
                #search-button {
                    position: absolute;
                    right: 0px;
                    top: 0px;
                    height: 40px;
                    box-sizing: border-box;
                }

                #search-button dbp-icon {
                    top: 0px;
                }


                #open-settings-btn {
                    margin-top: 0;
                }
                
                .table-wrapper {
                    flex-direction: column;
                    gap: 1em;
                }
                
                .edit-selection-buttons {
                    display: flex;
                    flex-direction: column-reverse;
                    gap: 1em;
                }
                
                .filter-buttons {
                    width: calc(100% - 45px);
                }
                
                button[data-page="prev"], button[data-page="next"], button[data-page="first"], button[data-page="last"] {
                    display: block;
                    white-space: nowrap !important;
                    overflow: hidden;
                    line-height: 0;
                }

                button[data-page="prev"]:after, button[data-page="next"]:after, button[data-page="first"]:after, button[data-page="last"]:after {
                    content: '\\00a0\\00a0\\00a0\\00a0';
                    background-color: var(--dbp-content);
                    -webkit-mask-repeat: no-repeat;
                    mask-repeat: no-repeat;
                    -webkit-mask-position: center center;
                    mask-position: center center;
                    padding: 0 0 0.25% 0;
                    -webkit-mask-size: 1.5rem !important;
                    mask-size: 1.4rem !important;
                }

                .tabulator .tabulator-footer .tabulator-paginator .tabulator-page {
                    border: none;
                }
                
                button[data-page="prev"]:after {
                    -webkit-mask-image: url("${unsafeCSS(getIconSVGURL('chevron-left'))}");
                    mask-image: url("${unsafeCSS(getIconSVGURL('chevron-left'))}");
                }

                button[data-page="next"]:after {
                    -webkit-mask-image: url("${unsafeCSS(getIconSVGURL('chevron-right'))}");
                    mask-image: url("${unsafeCSS(getIconSVGURL('chevron-right'))}");
                }

                button[data-page="first"]:after {
                    content: '\\00a0\\00a0\\00a0\\00a0\\00a0\\00a0\\00a0';
                    -webkit-mask-image: url("${unsafeCSS(getIconSVGURL('angle-double-left'))}");
                    mask-image: url("${unsafeCSS(getIconSVGURL('angle-double-left'))}");
                }

                button[data-page="last"]:after {
                    content: '\\00a0\\00a0\\00a0\\00a0\\00a0\\00a0\\00a0';
                    -webkit-mask-image: url("${unsafeCSS(getIconSVGURL('angle-double-right'))}");
                    mask-image: url("${unsafeCSS(getIconSVGURL('angle-double-right'))}");
                }

                .tabulator .tabulator-footer .tabulator-footer-contents .tabulator-paginator .tabulator-pages {
                    display: none;
                }
                
                .tabulator .tabulator-footer .tabulator-paginator {
                    text-align: center;
                }
                
                .tabulator .tabulator-footer .tabulator-paginator label {
                    display: none;
                }
                
                .tabulator .tabulator-footer .tabulator-paginator .tabulator-page {
                    border: none;
                }
                
                .tabulator .tabulator-footer .tabulator-paginator .tabulator-page-size {
                    padding-right: 1.5em;
                    background-size: auto 40%;
                }
                
                #custom-pagination {
                    position: sticky;
                    bottom: 0px;
                    z-index: 10;
                }
                
                .tabulator-footer {
                    position: sticky;
                    bottom: 0px;
                    z-index: 10;
                }
                                
                .tabulator {
                    overflow: visible;
                }
            }
        `;
    }

    render() {
        const i18n = this._i18n;
        const tabulatorCss = commonUtils.getAssetURL(
            pkgName,
            'tabulator-tables/css/tabulator.min.css'
        );

        if (this.isLoggedIn() && !this.isLoading() && !this._initialFetchDone && !this.initialRequestsLoading && this.organizationSet) {
            this.getListOfRequests();
        }

        return html`
            <link rel="stylesheet" href="${tabulatorCss}"/>
            
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
                                        detail: {name: 'create-request'},
                                    })
                                );
                                e.preventDefault();
                           }}"
                        >
                            <span>${i18n.t('show-requests.create-new-request')}.</span>
                        </a>
                    </p>
                </slot>
                
                 <div class="${classMap({hidden: this.showDetailsView })}">
                    ${i18n.t('show-requests.organization-select-description')}
                    <div class="choose-and-create-btns">
                        <dbp-resource-select
                                    id="show-resource-select"
                                    subscribe="lang,entry-point-url,auth"
                                    lang="${this.lang}"
                                    resource-path="dispatch/groups?lang=${this.lang}"
                                    @change=${(event) => {
                                        this.processSelectedOrganization(event);
                                        // console.log("read: ", this.mayRead);
                                        // console.log("write: ", this.mayWrite);
                                    }}
                        ></dbp-resource-select>
                    </div>
                </div>
                
                <div class="no-access-notification">
                    <dbp-inline-notification class="${classMap({ hidden: !this.isLoggedIn() || this.isLoading() || this.mayWrite || !this.organizationSet })}"
                                             type="${this.mayRead ? 'warning' : 'danger'}"
                                             body="${this.mayRead ? i18n.t('error-no-writes') : i18n.t('error-no-read')}">
                    </dbp-inline-notification>
                </div>
                
                <h3 class="${classMap({hidden: !this.isLoggedIn() || this.isLoading() || this.showDetailsView || !this.organizationSet })}">
                    ${i18n.t('show-requests.dispatch-orders')}
                </h3>
                
                <div class="${classMap({hidden: !this.isLoggedIn() || this.isLoading() || this.showDetailsView || !this.organizationSet || !this.mayRead})}">
                    <div class="table-wrapper">
                        <div class="selected-buttons">
                            <div class="filter-buttons ${classMap({hidden: !this.isLoggedIn() || this.isLoading() || this.showDetailsView || !this.organizationSet })}"
                                <div class="search-wrapper ">
                                    <div id="extendable-searchbar">
                                        <input type="text" id="searchbar" placeholder="Suchen" @click='${() => {
                                            this.toggleSearchMenu();
                                        }}'>
                                        <dbp-icon-button id="search-button" title="Suchen" icon-name="search" 
                                            @click='${() => {
                                                this.filterTable();
                                            }}'></dbp-icon-button>
                                        <ul class='extended-menu hidden' id='searchbar-menu'>
                                            <label for='search-select'>${i18n.t('show-requests.search-in')}:</label>
                                            <select id='search-select' class='button dropdown-menu'
                                                    title='${i18n.t('show-requests.search-in-column')}:'>
                                                ${this.getTableHeaderOptions()}
                                            </select>
                                            
                                            <label for='search-operator'>${i18n.t('show-requests.search-operator')}
                                                :</label>
                                            <select id='search-operator' class='button dropdown-menu'>
                                                <option value='like'>${i18n.t('show-requests.search-operator-like')}
                                                </option>
                                                <option value='='>${i18n.t('show-requests.search-operator-equal')}</option>
                                                <option value='!='>${i18n.t('show-requests.search-operator-notequal')}
                                                </option>
                                                <option value='starts'>${i18n.t('show-requests.search-operator-starts')}
                                                </option>
                                                <option value='ends'>${i18n.t('show-requests.search-operator-ends')}
                                                </option>
                                                <option value='<'>${i18n.t('show-requests.search-operator-less')}</option>
                                                <option value='<='>
                                                    ${i18n.t('show-requests.search-operator-lessthanorequal')}
                                                </option>
                                                <option value='>'>${i18n.t('show-requests.search-operator-greater')}
                                                </option>
                                                <option value='>='>
                                                    ${i18n.t('show-requests.search-operator-greaterorequal')}
                                                </option>
                                                <option value='regex'>${i18n.t('show-requests.search-operator-regex')}
                                                </option>
                                                <option value='keywords'>
                                                    ${i18n.t('show-requests.search-operator-keywords')}
                                                </option>
                                            </select>
                                        </ul>
                                    </div>
                                </div>
                                <dbp-icon-button class="hidden ${classMap({hidden: !this.isLoggedIn() || this.isLoading() || this.showDetailsView })}" id="open-settings-btn"
                                            ?disabled="${this.loading}"
                                            @click="${() => { console.log('open settings'); }}"
                                            title="TODO"
                                            icon-name="iconoir_settings"></dbp-icon-button>
                            </div>
                        
                            ${ this.mayWrite ? html`
                                <div class="edit-selection-buttons ${classMap({hidden: !this.isLoggedIn() || this.isLoading() || this.showDetailsView })}">
                                    <dbp-loading-button id="delete-all-btn"
                                                        ?disabled="${this.loading || !this.rowsSelected}"
                                                        value="${i18n.t('show-requests.delete-button-text')}"
                                                        @click="${(event) => { this.deleteSelected(event); }}"
                                                        title="${i18n.t('show-requests.delete-button-text')}"
                                    >
                                        ${i18n.t('show-requests.delete-button-text')}
                                    </dbp-loading-button>
                                    <dbp-loading-button id="submit-all-btn"
                                                        type="is-primary"
                                                        ?disabled="${this.loading || !this.rowsSelected}"
                                                        value="${i18n.t('show-requests.submit-button-text')}"
                                                        @click="${(event) => { this.submitSelected(event); }}"
                                                        title="${i18n.t('show-requests.submit-button-text')}"
                                    >
                                        ${i18n.t('show-requests.submit-button-text')}
                                    </dbp-loading-button>
                                </div>
                            ` : `` }
                        </div>
                        
                        
                            <div class="control table ${classMap({hidden: !this.initialRequestsLoading})}">
                                <span class="loading">
                                    <dbp-mini-spinner text=${i18n.t('show-requests.loading-table-message')}></dbp-mini-spinner>
                                </span>
                            </div>
                            
                        
                            <div class="dispatch-table ${classMap({hidden: !this.isLoggedIn() || this.isLoading() || this.showDetailsView || this.initialRequestsLoading })}">
                                <div id="dispatch-requests-table" class=""></div>
                                <div class='tabulator' id='custom-pagination'>
                                    <div class='tabulator-footer'>
                                        <div class='tabulator-footer-contents'>
                                            <span class='tabulator-paginator'></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ${ this.mayRead ? html`
                    <div class="back-container">
                        <span class="back-navigation ${classMap({hidden: !this.isLoggedIn() || this.isLoading() || this.showListView || !this.organizationSet })}">
                            <a href="#" title="${i18n.t('show-requests.back-to-list')}"
                               @click="${() => {
                                   this.getListOfRequests();
                                   this.showListView = true;
                                   this.showDetailsView = false;
                                   this.currentItem = {};
                                   this.currentItem.files = [];
                                   this.currentItem.recipients = [];
                                   this.currentRecipient = {};
                                   this.currentItem.senderGivenName = "";
                                   this.currentItem.senderFamilyName = "";
                                   this.currentItem.senderAddressCountry = "";
                                   this.currentItem.senderPostalCode = "";
                                   this.currentItem.senderAddressLocality = "";
                                   this.currentItem.senderStreetAddress = "";
                                   this.currentItem.senderBuildingNumber = "";
                               }}"
                            >
                                <dbp-icon name="chevron-left"></dbp-icon>
                                ${i18n.t('show-requests.back-to-list')}
                            </a>
                        </span>
                    </div>
                    
                    <h3 class="${classMap({hidden: !this.isLoggedIn() || this.isLoading() || this.showListView || !this.organizationSet })}">
                        ${(this.currentItem && this.currentItem.dateSubmitted) || !this.mayWrite ? 
                               i18n.t('show-requests.show-detailed-dispatch-order', { id: this.currentItem.identifier }) 
                               : i18n.t('show-requests.detailed-dispatch-order', { id: this.currentItem.identifier })
                        }:
                        <dbp-info-tooltip
                                class="info-tooltip"
                                text-content="${i18n.t('show-requests.table-header-id')}: ${this.currentItem.identifier}"
                                interactive></dbp-info-tooltip>
                    </h3>
    
                    <div class="${classMap({hidden: !this.isLoggedIn() || this.isLoading() || this.showListView || !this.organizationSet })}">
    
                        ${ this.currentItem && !this.currentItem.dateSubmitted ? html`
                                <div class="request-buttons">
                                    <div class="edit-buttons">
                                        <dbp-loading-button id="delete-btn" 
                                                            ?disabled="${this.loading || this.currentItem.dateSubmitted || !this.mayWrite}" 
                                                            value="${i18n.t('show-requests.delete-button-text')}" 
                                                            @click="${(event) => { this.deleteRequest(event, this.currentItem); }}" 
                                                            title="${i18n.t('show-requests.delete-button-text')}"
                                        >
                                            ${i18n.t('show-requests.delete-button-text')}
                                        </dbp-loading-button>
                                    </div>
                                    <div class="submit-button">
                                        <dbp-loading-button type="is-primary"
                                                            id="submit-btn" 
                                                            ?disabled="${this.loading || this.currentItem.dateSubmitted || !this.mayWrite}" 
                                                            value="${i18n.t('show-requests.submit-button-text')}" 
                                                            @click="${(event) => { this.submitRequest(event, this.currentItem); }}" 
                                                            title="${i18n.t('show-requests.submit-button-text')}"
                                        >
                                            ${i18n.t('show-requests.submit-button-text')}
                                        </dbp-loading-button>
                                    </div>
                                </div>` : ``
                        }
                        
                        ${ this.currentItem ? html`
                            <div class="request-item details">
                                <div class="details header">
                                    <div>
                                        <div class="section-titles">
                                            ${i18n.t('show-requests.id')}
                                            ${!this.currentItem.dateSubmitted ? html`
                                                <dbp-icon-button id="edit-subject-btn"
                                                             ?disabled="${this.loading || this.currentItem.dateSubmitted || !this.mayWrite}"
                                                             @click="${(event) => {
                                                                 this.subject = this.currentItem.name ? this.currentItem.name : '';
                                                                 MicroModal.show(this._('#edit-subject-modal'), {
                                                                     disableScroll: true,
                                                                     onClose: (modal) => {
                                                                         this.loading = false;
                                                                     },
                                                                 });
                                                            }}"
                                                             title="${i18n.t('show-requests.edit-subject-button-text')}"
                                                             icon-name="pencil"></dbp-icon-button>` : ``}
                                        </div>
                                        <div>${this.currentItem.name ? html`${this.currentItem.name}` : html`${i18n.t('show-requests.no-subject-found')}`}</div>
                                    </div>
                                    <div class="line"></div>
                                    <div>
                                        <div class="section-titles">${i18n.t('show-requests.submit-status')}</div>
                                        <div>${this.currentItem.dateSubmitted ? html`<span class="status-green">●</span> ${i18n.t('show-requests.status-completed-date', {date: this.convertToReadableDate(this.currentItem.dateSubmitted)})}` : html`<span class="status-orange">●</span> ${i18n.t('show-requests.empty-date-submitted')}`}</div>
                                    </div>
                                    <div class="line"></div>
                                    <div>
                                        <div class="section-titles">${i18n.t('show-requests.date-created')}</div>
                                        <div>${this.convertToReadableDate(this.currentItem.dateCreated)}</div>
                                    </div>
                                </div>
                                
                                <div class="details sender hidden">
                                    <div class="header-btn">
                                        <div class="section-titles">${i18n.t('show-requests.sender')}</div>
                                        ${!this.currentItem.dateSubmitted ? html`
                                            <dbp-icon-button id="edit-sender-btn"
                                                        ?disabled="${this.loading || this.currentItem.dateSubmitted || !this.mayWrite}"
                                                        @click="${(event) => {
                                                            if (this.currentItem.senderAddressCountry !== '') {
                                                                this._('#edit-sender-country-select').value = this.currentItem.senderAddressCountry;
                                                            }
                                                            MicroModal.show(this._('#edit-sender-modal'), {
                                                                disableScroll: true,
                                                                onClose: (modal) => {
                                                                    this.loading = false;
                                                                },
                                                            });
                                                        }}"
                                                        title="${i18n.t('show-requests.edit-sender-button-text')}" 
                                                        icon-name="pencil"></dbp-icon-button>` : ``}
                                    </div>
                                    <div class="sender-data">
                                        ${this.currentItem.senderGivenName ? html`${this.currentItem.senderGivenName}` : ``}
                                        ${this.currentItem.senderFamilyName && this.currentItem.senderGivenName
                                                ? html` ${this.currentItem.senderFamilyName}` :
                                                html`${this.currentItem.senderFamilyName ? html`${this.currentItem.senderFamilyName}` : ``}
                                        `}
                                        ${this.currentItem.senderStreetAddress ? html`<br>${this.currentItem.senderStreetAddress}` : ``}
                                        ${this.currentItem.senderBuildingNumber ? html` ${this.currentItem.senderBuildingNumber}` : ``}
                                        ${this.currentItem.senderPostalCode ? html`<br>${this.currentItem.senderPostalCode}` : ``}
                                        ${this.currentItem.senderAddressLocality ? html` ${this.currentItem.senderAddressLocality}` : ``}
                                        ${this.currentItem.senderAddressCountry ? html`<br>${dispatchHelper.getCountryMapping()[this.currentItem.senderAddressCountry]}` : ``}
                                    </div>
    
                                    <div class="no-sender ${classMap({hidden: !this.isLoggedIn() || this.currentItem.senderFamilyName})}">${i18n.t('show-requests.empty-sender-text')}</div>
    
                                </div>
                                
                                <div class="details files">
                                    <div class="header-btn">
                                        <div class="section-titles">${i18n.t('show-requests.files')} <span class="section-title-counts">
                                                ${this.currentItem.files.length !== 0 ? `(` + this.currentItem.files.length + `)` : ``}</span>
                                        </div>
                                        ${!this.currentItem.dateSubmitted ? html`
                                             <dbp-loading-button id="add-files-btn"
                                                            ?disabled="${this.loading || this.currentItem.dateSubmitted || !this.mayWrite}"
                                                            value="${i18n.t('show-requests.add-files-button-text')}" 
                                                            @click="${(event) => {
                                                                this.openFileSource();
                                                            }}"
                                                            title="${i18n.t('show-requests.add-files-button-text')}"
                                            >
                                                ${i18n.t('show-requests.add-files-button-text')}
                                            </dbp-loading-button>` : ``
                                        }
                                    </div>
                                    <div class="files-data">
                                        ${this.currentItem.files.map(file => html`
                                            <div class="file card">
                                                <div class="left-side">
                                                    <div>${file.name}</div>
                                                    <div>${humanFileSize(file.contentSize)}</div>
                                                    <div>${file.fileFormat}</div>
                                                    <div>${this.convertToReadableDate(file.dateCreated)}</div>
                                                </div>
                                                <div class="right-side">
                                                    <dbp-icon-button id="show-file-btn"
                                                                @click="${(event) => {
                                                                    console.log("on show file clicked");
                                                                    //TODO show file viewer with pdf
                                                                }}"
                                                                class="hidden" <!-- TODO -->
                                                                title="${i18n.t('show-requests.show-file-button-text')}"
                                                                icon-name="keyword-research"></dbp-icon-button>
                                                    ${!this.currentItem.dateSubmitted ? html`
                                                        <dbp-icon-button id="delete-file-btn"
                                                                    ?disabled="${this.loading || this.currentItem.dateSubmitted || !this.mayWrite}"
                                                                    @click="${(event) => {
                                                                        console.log("on delete file clicked");
                                                                        this.deleteFile(file);
                                                                    }}"
                                                                    title="${i18n.t('show-requests.delete-file-button-text')}" 
                                                                    icon-name="trash"></dbp-icon-button>` : ``
                                                    }
                                                </div>
                                            </div>
                                        `)}
                                        <div class="no-files ${classMap({hidden: !this.isLoggedIn() || this.currentItem.files.length !== 0})}">${i18n.t('show-requests.empty-files-text')}</div>
                                       
                                    </div>
                                </div>
    
                                <div class="details recipients">
                                    <div class="header-btn">
                                        <div class="section-titles">${i18n.t('show-requests.recipients')} <span class="section-title-counts">
                                                ${this.currentItem.recipients.length !== 0 ? `(` + this.currentItem.recipients.length + `)` : ``}</span>
                                        </div>
                                        ${!this.currentItem.dateSubmitted ? html`
                                            <dbp-loading-button id="add-recipient-btn"
                                                            ?disabled="${this.loading || this.currentItem.dateSubmitted || !this.mayWrite}"
                                                            value="${i18n.t('show-requests.add-recipient-button-text')}" 
                                                            @click="${(event) => {
                                                                this.currentRecipient = {};
                                                                MicroModal.show(this._('#add-recipient-modal'), {
                                                                    disableScroll: true,
                                                                    onClose: (modal) => {
                                                                        this.loading = false;
                                                                    },
                                                                });
                                                            }}" 
                                                            title="${i18n.t('show-requests.add-recipient-button-text')}">
                                                ${i18n.t('show-requests.add-recipient-button-text')}
                                            </dbp-loading-button>` : ``
                                        }
                                    </div>
                                </div>
                                
                                <div class="recipients-data">
                                    ${this.currentItem.recipients.map(recipient => html`
    
                                        <div class="recipient card">
                                            <div class="left-side">
                                                <div>${recipient.givenName} ${recipient.familyName}</div>
                                                <div>${recipient.streetAddress} ${recipient.buildingNumber}</div>
                                                <div>${recipient.postalCode} ${recipient.addressLocality}</div>
                                                <div>${dispatchHelper.getCountryMapping()[recipient.addressCountry]}</div>
                                                <div>${this.currentRecipient && this.currentRecipient.statusDescription ? html`
                                                    ${this.currentRecipient.statusDescription.includes('P6') && this.currentItem.dateSubmitted ? html `
                                                        <span class="status-green">●</span><span class="new-line-content"> Status: ${this.currentRecipient.statusDescription}</span>
                                                    ` : html`
                                                        Status: ${this.currentRecipient.statusDescription}
                                                    `}
                                                ` : ``}</div>
                                            </div>
                                            <div class="right-side">
                                                    <dbp-icon-button id="show-recipient-btn"
                                                                @click="${() => {
                                                                    this.currentRecipient = recipient;
                                                                    this._('#show-recipient-btn').start();
                                                                    try {
                                                                        this.fetchDetailedRecipientInformation(recipient.identifier).then(() => {
                                                                            MicroModal.show(this._('#show-recipient-modal'), {
                                                                                disableScroll: true,
                                                                                onClose: (modal) => {
                                                                                    this.loading = false;
                                                                                    // this.currentRecipient = {};
                                                                                    this._('#show-recipient-btn').stop();
                                                                                },
                                                                            });
                                                                        });
                                                                    } catch {
                                                                        this._('#show-recipient-btn').stop();
                                                                    }
                                                                }}"
                                                                title="${i18n.t('show-requests.show-recipient-button-text')}"
                                                                icon-name="keyword-research"></dbp-icon></dbp-icon-button>
                                                    ${!this.currentItem.dateSubmitted ? html`
                                                        <dbp-icon-button id="edit-recipient-btn"
                                                                     ?disabled="${this.loading || this.currentItem.dateSubmitted || !this.mayWrite}"
                                                                     @click="${() => {
                                                                         this.currentRecipient = recipient;
                                                                         this._('#edit-recipient-btn').start();
                                                                         try {
                                                                            this.fetchDetailedRecipientInformation(recipient.identifier).then(() => {
                                                                                this._('#edit-recipient-country-select').value = this.currentRecipient.addressCountry;
                                                                                this._('#tf-edit-recipient-birthdate').value = this.currentRecipient.birthDate;
                                                                                MicroModal.show(this._('#edit-recipient-modal'), {
                                                                                    disableScroll: true,
                                                                                    onClose: (modal) => {
                                                                                        this.loading = false;
                                                                                        this.currentRecipient = {};
                                                                                    }
                                                                                });
                                                                            });
                                                                         } catch {
                                                                             this._('#edit-recipient-btn').stop();
                                                                         }
                                                                     }}"
                                                                     title="${i18n.t('show-requests.edit-recipients-button-text')}"
                                                                     icon-name="pencil"></dbp-icon-button>
                                                        <dbp-icon-button id="delete-recipient-btn"
                                                                    ?disabled="${this.loading || this.currentItem.dateSubmitted || !this.mayWrite}"
                                                                    @click="${() => {
                                                                        this.deleteRecipient(recipient);
                                                                    }}"
                                                                    title="${i18n.t('show-requests.delete-recipient-button-text')}"
                                                                    icon-name="trash"></dbp-icon-button>` : ``
                                                    }
                                            </div>
                                        </div>
                                    `)}
                                    <div class="no-recipients ${classMap({hidden: !this.isLoggedIn() || this.currentItem.recipients.length !== 0})}">${i18n.t('show-requests.no-recipients-text')}</div>
                                  
                                </div>
                            </div>
                        ` : ``}
                    ` : ``}
                </div>
            </div>
            
            ${this.addFilePicker()}
            
            ${this.addEditSenderModal()}
            
            ${this.addAddRecipientModal()}

            ${this.addEditRecipientModal()}

            ${this.addShowRecipientModal()}

            ${this.addEditSubjectModal()}
        `;
    }
}

commonUtils.defineCustomElement('dbp-show-requests', ShowRequests);
