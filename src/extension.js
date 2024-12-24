"use strict";

import Clutter from "gi://Clutter";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import St from "gi://St";
import Gio from "gi://Gio";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import * as Dialog from "resource:///org/gnome/shell/ui/dialog.js";
import * as ModalDialog from "resource:///org/gnome/shell/ui/modalDialog.js";
import GObject from "gi://GObject";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

import * as Proxmox from "./modules/proxmox.js";

export default class ContainersExtension extends Extension {
    /**
     * enable is the entry point called by gnome-shell
     */
    enable() {
        console.log(`enabling ${this.uuid} extension`);
        this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);
        this.menu = this._indicator.menu;
        this._settings = this.getSettings();

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
                this._sync();
            } else {
                this._stop_sync();
            }
        });

        Main.panel.addToStatusArea(this.uuid, this._indicator);

        this._renderMenu();
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

    async _sync() {

    }

    async _stop_sync() {

    }

    async _renderMenu() {
        try {
            this.menu.removeAll();

            const prefs = new PopupMenu.PopupMenuItem("Preferences");
            prefs.connect("activate", () => this.openPreferences());

            this.menu.addMenuItem(prefs);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            const test = new PopupMenu.PopupMenuItem("Test");
            
            test.connect("activate", () => {
                
                let formatedToken = "PVEAPIToken=";
                formatedToken += this._settings.get_string("api-token-id");
                formatedToken += "=";
                formatedToken += this._settings.get_string("api-secret");

                Proxmox.checkProxmoxHealth({
                    node: this._settings.get_string("pve-host")
                }).then((isAlive) => {

                    if (!isAlive) {
                        log(`Proxmox is NOT alive - Skipping refresh`);
                        return;
                    }

                    Proxmox.getAllVms({
                        node: this._settings.get_string("pve-host"),
                        token: formatedToken,
                        allowUnsafeSsl: this._settings.get_boolean('allow-unsafe-ssl')
                    }).then((vms) => {
                        log(`[DEBUG - getAllVms] ${JSON.stringify(vms)}`);
                    }).catch((error) => {
                        log(`[DEBUG - getAllVms] ${error}`);
                    });
                }).catch((error) => {
                    log(`[DEBUG - checkProxmoxHealth] ${error}`);
                });
            });
            this.menu.addMenuItem(test);
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

    constructor(container, settings) {
        super(container.name);
        this.menu.box.add_style_class_name("container-menu-item");
        const label = new St.Label({ text: container.image });
        label.add_style_class_name("container-name-label");
        const actions = new PopupMenu.PopupBaseMenuItem({ reactive: false, can_focus: false, style_class: "container-action-bar" });
        actions.actor.set_x_expand(true);
        actions.actor.set_x_align(Clutter.ActorAlign.END);
        // this.insert_child_at_index(actions, 2);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const startBtn = createActionButton(() => container.start(), "media-playback-start-symbolic");
        const stopBtn = createActionButton(() => container.stop(), "media-playback-stop-symbolic");
        const restartBtn = createActionButton(() => container.restart(), "system-reboot-symbolic");
        const pauseBtn = createActionButton(
            () => {
                if (container.status.split(" ")[0] === "running") {
                    container.pause();
                }
                if (container.status.split(" ")[0] === "paused") {
                    container.unpause();
                }
            },
            "media-playback-pause-symbolic"
        );
        pauseBtn.toggle_mode = true;
        const deleteBtn = createActionButton(
            () => new RemoveContainerDialog(container).open(1, true),
            "user-trash-symbolic");

        switch (container.status.split(" ")[0]) {
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
                deleteBtn.reactive = false;
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
        this.insert_child_at_index(deleteBtn, 4);

        if (settings.extraInfo) {
            const info = new PopupMenu.PopupMenuItem(`${container.details()}`);
            info.add_style_class_name("container-info");
            this.menu.addMenuItem(info);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }

        this.menu.addAction("Show Logs", () => container.logs());
        this.menu.addAction("Watch Top", () => container.watchTop());
        this.menu.addAction("Open Shell", () => container.shell());
        this.menu.addAction("Watch Statistics", () => container.stats());
        this.menu.addAction("Copy Container Details", () => setClipboard(container.details()));
        // the css nth- or last-of-type is probably not implemented in gjs
        this.menu.box.get_children().at(-1).add_style_class_name("last-container-menu-item");
    }
}

/**
 * set clipboard with @param text
 * @param {string} text to set the clipboard with
 */
function setClipboard(text) {
    St.Clipboard.get_default().set_text(St.ClipboardType.PRIMARY, text);
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

class RemoveContainerDialog extends ModalDialog.ModalDialog {
    static {
        GObject.registerClass(this);
    }

    constructor(container) {
        super();
        const content = new Dialog.MessageDialogContent({
            title: "Remove Container",
            description: `Are you sure you want to remove container ${container.name}?`,
        });
        this.contentLayout.add_child(content);
        this.addButton({
            action: () => this.close(),
            label: "Cancel",
            key: Clutter.KEY_Escapse,
        });
        this.addButton({
            action: () => {
                this.close();
                container.rm();
            },
            label: "Remove",
        });
    }
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
