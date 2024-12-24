import Adw from "gi://Adw";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";

import {ExtensionPreferences, gettext as _} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class ContainersPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window._settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: _("General"),
            icon_name: "dialog-information-symbolic",
        });
        window.add(page);

        const generalGroup = new Adw.PreferencesGroup({
            title: _("General"),
            description: _("Configure the extension settings"),
        });

        page.add(generalGroup);

        // Current refresh
        let currentRefreshSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 10,
                step_increment: 1,
                page_increment: 10,
                value: window._settings.get_int('refresh-interval')  / 60
            }),
            climb_rate: 5,
            numeric: true,
            update_policy: 'if-valid',
            valign: Gtk.Align.CENTER
        });

        currentRefreshSpinButton.connect("value-changed", () => {
            window._settings.set_int('refresh-interval', currentRefreshSpinButton.get_value() * 60);
        });

        let currentRefreshRow = new Adw.ActionRow({
            title: _("Current data refresh interval"),
            subtitle: _("Current data refresh interval in minutes"),
            activatable_widget: currentRefreshSpinButton
        });

        currentRefreshRow.add_suffix(currentRefreshSpinButton);
        generalGroup.add(currentRefreshRow);

        // add boolean setting for "allow-unsafe-ssl"
        let allowUnsafeSslSwitch = new Gtk.Switch({
            active: window._settings.get_boolean('allow-unsafe-ssl'),
            valign: Gtk.Align.CENTER
        });

        allowUnsafeSslSwitch.connect("notify::active", () => {
            window._settings.set_boolean('allow-unsafe-ssl', allowUnsafeSslSwitch.active);
        });

        let allowUnsafeSslRow = new Adw.ActionRow({
            title: _("Allow unsafe SSL"),
            subtitle: _("Allow proxmox default self-signed SSL certificates"),
            activatable_widget: allowUnsafeSslSwitch
        });

        allowUnsafeSslRow.add_suffix(allowUnsafeSslSwitch);
        generalGroup.add(allowUnsafeSslRow);

        let separator = new Gtk.Separator();
        generalGroup.add(separator);


        // Proxmox info group
        const proxmoxGroup = new Adw.PreferencesGroup({
            title: _("Proxmox"),
            description: _("Configure the Proxmox settings"),
        });

        page.add(proxmoxGroup);

        // Proxmox node
        let proxmoxNodeEntry = new Gtk.Entry({
            text: window._settings.get_string('pve-host'),
            valign: Gtk.Align.CENTER
        });

        proxmoxNodeEntry.connect("changed", () => {
            window._settings.set_string('pve-host', proxmoxNodeEntry.get_text());
        });

        let proxmoxNodeRow = new Adw.ActionRow({
            title: _("Proxmox node"),
            subtitle: _("(e.g. proxmox.example.com)"),
            activatable_widget: proxmoxNodeEntry
        });

        proxmoxNodeRow.add_suffix(proxmoxNodeEntry);
        proxmoxGroup.add(proxmoxNodeRow);

        // Proxmox password
        let proxmoxPasswordEntry = new Gtk.Entry({
            text: window._settings.get_string('api-token-id'),
            visibility: false,
            valign: Gtk.Align.CENTER
        });

        proxmoxPasswordEntry.connect("changed", () => {
            window._settings.set_string('api-token-id', proxmoxPasswordEntry.get_text());
        });

        let proxmoxPasswordRow = new Adw.ActionRow({
            title: _("Proxmox Token ID"),
            subtitle: _("(e.g. user@pve!gshell)"),
            activatable_widget: proxmoxPasswordEntry
        });

        proxmoxPasswordRow.add_suffix(proxmoxPasswordEntry);
        proxmoxGroup.add(proxmoxPasswordRow);

        // Proxmox token
        let proxmoxTokenEntry = new Gtk.Entry({
            text: window._settings.get_string('api-secret'),
            visibility: false,
            valign: Gtk.Align.CENTER
        });

        proxmoxTokenEntry.connect("changed", () => {
            window._settings.set_string('api-secret', proxmoxTokenEntry.get_text());
        });

        let proxmoxTokenRow = new Adw.ActionRow({
            title: _("Proxmox Secret"),
            subtitle: _("(e.g. xxxx-xxxx-xxxx)"),
            activatable_widget: proxmoxTokenEntry
        });

        proxmoxTokenRow.add_suffix(proxmoxTokenEntry);
        proxmoxGroup.add(proxmoxTokenRow);

    }
}

