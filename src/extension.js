"use strict";

import Clutter from "gi://Clutter";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import St from "gi://St";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import GObject from "gi://GObject";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

import * as Proxmox from "./modules/proxmox.js";

export default class ContainersExtension extends Extension {

    _init() {
        //region Variables
        this._settings = this.getSettings();
        this._idle = false;
        this._connected = false;
        this._network_monitor = Gio.network_monitor_get_default();
        this.getAllVms = Proxmox.getAllVms;
        //endregion

        //region Signals
        this._network_monitor_connection = this._network_monitor.connect('network-changed', this._onNetworkStateChanged.bind(this));
        //endregion

        this._checkConnectionState();
    }

    _initUI() {
        console.log(`enabling ${this.uuid} extension`);
        this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);
        this.menu = this._indicator.menu;

        this._indicator.menu.box.add_style_class_name("containers-extension-menu");
        const hbox = new St.BoxLayout({ style_class: "panel-status-menu-box" });
        const ext = Extension.lookupByUUID("proxmoxvms@tiotbenjy");
        const gicon = Gio.icon_new_for_string(`${ext.path}/proxmox-icon.png`);
        const icon = new St.Icon({ gicon, icon_size: "24" });
        this._indicator.add_child(icon);
        this._indicator.add_child(hbox);

        this._indicator.menu.connect("open-state-changed", () => {
            if (this.menu.isOpen) {
                this._renderMenu();
            }
        });

        Main.panel.addToStatusArea(this.uuid, this._indicator);

        this._renderMenu();
    }

    stop() {
        if (this._timeoutCheckConnectionState) {
            GLib.source_remove(this._timeoutCheckConnectionState);
            this._timeoutCheckConnectionState = null;
        }

        if (this._presence_connection) {
            this._presence.disconnectSignal(this._presence_connection);
            this._presence_connection = undefined;
        }

        if (this._network_monitor_connection) {
            this._network_monitor.disconnect(this._network_monitor_connection);
            this._network_monitor_connection = undefined;
        }
    }

    /**
     * enable is the entry point called by gnome-shell
     */
    enable() {
        this._init();
        this._initUI();
    }


    /**
     * disable is called when the main extension menu is closed
     */
    disable() {
        console.log("disabling containers extension");
        this._indicator?.destroy();
        this._indicator = null;
        this._settings = null;
    }

    _onNetworkStateChanged() {
        this._checkConnectionState();
    }

    _checkConnectionState() {
        this._checkConnectionStateRetries = 3;
        this._oldConnected = this._connected;
        this._connected = false;

        this._checkConnectionStateWithRetries(1250);
    }

    _checkConnectionStateWithRetries(interval) {
        if (this._timeoutCheckConnectionState) {
            GLib.source_remove(this._timeoutCheckConnectionState);
            this._timeoutCheckConnectionState = null;
        }

        this._timeoutCheckConnectionState = GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => {
            this._timeoutCheckConnectionState = null;
            let url = this._settings.get_string("pve-host");

            if (!url.startsWith("https://")) {
                url = "https://" + url;
            }

            let address = Gio.NetworkAddress.parse_uri(url, 80);
            let cancellable = Gio.Cancellable.new();
            try {
                this._network_monitor.can_reach_async(address, cancellable, this._asyncReadyCallback.bind(this));
            } catch (err) {
                let title = _("Can not connect to %s").format(url);
                log(title + '\n' + err.message);
                this._checkConnectionStateRetry();
            }
            return false;
        });
    }

    _checkConnectionStateRetry() {
        if (this._checkConnectionStateRetries > 0) {
            let timeout;
            if (this._checkConnectionStateRetries == 3)
                timeout = 10000;
            else if (this._checkConnectionStateRetries == 2)
                timeout = 30000;
            else if (this._checkConnectionStateRetries == 1)
                timeout = 60000;

            this._checkConnectionStateRetries -= 1;
            this._checkConnectionStateWithRetries(timeout);
        }
    }

    _asyncReadyCallback(nm, res) {
        try {
            this._connected = this._network_monitor.can_reach_finish(res);
        } catch (err) {
            log(title + '\n' + err.message);
            this._checkConnectionStateRetry();
            return;
        }
        if (!this._oldConnected && this._connected) {

        }
    }

    async _renderMenu() {
        try {
            this.menu.removeAll();

            const prefs = new PopupMenu.PopupMenuItem("Preferences");
            prefs.connect("activate", () => this.openPreferences());

            this.menu.addMenuItem(prefs);

            const test = new PopupMenu.PopupMenuItem("Test - 1");

            test.connect("activate", () => {
                Proxmox.checkProxmoxHealth({
                    node: this._settings.get_string("pve-host")
                }).then((isAlive) => {

                    if (!isAlive) {
                        log(`Proxmox is NOT alive - Skipping refresh`);
                        return;
                    }

                    this.getAllVms().then((vms) => {
                        for (let [_, containers] of vms) {
                            for (let c of containers) {
                                this.menu.addMenuItem(new ContainerSubMenuItem(c, this._settings));
                            }
                        }
                    }).catch((error) => {
                        log(`[ERROR - getAllVms] ${error}`);
                    });
                }).catch((error) => {
                    log(`[ERROR - checkProxmoxHealth] ${error}`);
                });
            });

            this.menu.addMenuItem(test);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        } catch (err) {
            this.menu.removeAll();
            const errMsg = "Error occurred when fetching containers";
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem(errMsg));
            console.error(`${errMsg}: ${err}`);
        }
    }
}

class ContainerSubMenuItem extends PopupMenu.PopupSubMenuMenuItem {
    static {
        GObject.registerClass(this);
    }

    constructor(vm, settings) {
        super(vm.displayName);
        this.menu.box.add_style_class_name("container-menu-item");
        const label = new St.Label({ text: vm.displayName });
        label.add_style_class_name("container-name-label");
        const actions = new PopupMenu.PopupBaseMenuItem({ reactive: false, can_focus: false, style_class: "container-action-bar" });
        actions.actor.set_x_expand(true);
        actions.actor.set_x_align(Clutter.ActorAlign.END);
        // this.insert_child_at_index(actions, 2);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const startBtn = createActionButton(() => vm.start(), "media-playback-start-symbolic");
        const stopBtn = createActionButton(() => vm.stop(), "media-playback-stop-symbolic");
        const restartBtn = createActionButton(() => vm.restart(), "system-reboot-symbolic");
        const pauseBtn = createActionButton(
            () => {
                if (vm.status.split(" ")[0] === "running") {
                    vm.pause();
                }
                if (vm.status.split(" ")[0] === "paused") {
                    vm.unpause();
                }
            },
            "media-playback-pause-symbolic"
        );

        pauseBtn.toggle_mode = true;

        switch (vm.status.split(" ")[0]) {
            case "Exited":
            case "exited":
            case "Created":
            case "created":
            case "configured":
            case "stopped": {
                pauseBtn.reactive = false;
                this.insert_child_at_index(createIcon("media-playback-stop-symbolic", "status-stopped"), 1);
                // the element on index 3 is the expander, a spacer that clutter fills with space
                this.insert_child_at_index(startBtn, 4);
                break;
            }
            case "Up":
            case "running": {
                pauseBtn.checked = false;
                this.insert_child_at_index(createIcon("media-playback-start-symbolic", "status-running"), 1);
                // the element on index 3 is the expander, a spacer that clutter fills with space
                this.insert_child_at_index(stopBtn, 4);
                break;
            }
            case "Paused":
            case "paused": {
                pauseBtn.checked = true;
                this.insert_child_at_index(createIcon("media-playback-pause-symbolic", "status-paused"), 1);
                break;
            }
            default:
                this.insert_child_at_index(createIcon("action-unavailable-symbolic", "status-undefined"), 1);
                break;
        }

        // the element on index 3 is the expander, a spacer that clutter fills with space
        this.insert_child_at_index(restartBtn, 4);
        this.insert_child_at_index(pauseBtn, 4);

        // this.menu.addAction("Show Logs", () => vm.logs());
        // this.menu.addAction("Watch Top", () => vm.watchTop());
        // this.menu.addAction("Open Shell", () => vm.shell());
        // this.menu.addAction("Watch Statistics", () => vm.stats());
        // the css nth- or last-of-type is probably not implemented in gjs

        const info = new PopupMenu.PopupMenuItem("Loading details...");
        info.add_style_class_name("container-info");
        this.menu.addMenuItem(info);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.box.get_children().at(-1).add_style_class_name("last-container-menu-item");

        // Fetch and update details asynchronously
        (async () => {
            const details = await vm.details(); // Ensure `vm.details()` works with await
            info.label.text = details; // Update the info menu item with fetched details
        })();
    }
}

/**
 * creates a button for a primary container action
 * @param {Function} command is the action executed when clicking the button
 * @param {string} iconName is the icon name
 * @returns {St.Button} new icon
 */
function createActionButton(command, iconName) {
    const btn = new St.Button({
        track_hover: true,
        style_class: "containers-action-button button",
    });
    btn.child = new St.Icon({
        icon_name: iconName,
        style_class: "popup-menu-icon",
    });
    btn.connect("clicked", () => {
        command();
    });
    return btn;
}

/**
 * createIcon is just a convenience shortcut for standard icons
 * @param {string} name is icon name
 * @param {string} styleClass is style_class
 * @returns {St.icon} new icon
 */
function createIcon(name, styleClass) {
    return new St.Icon({ icon_name: name, style_class: `${styleClass} popup-menu-icon` });
}
