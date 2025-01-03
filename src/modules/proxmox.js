/**
 * Proxmox module
 */

"use strict";

import Gio from "gi://Gio";
import GLib from "gi://GLib";
import * as Utils from "./utils.js";

Gio._promisify(Gio.Subprocess.prototype, "communicate_utf8_async", "communicate_utf8_finish");

export async function checkProxmoxHealth(params) {
    // ping node with system command to check if it is reachable
    try {
        if (params.node.includes(":")) {
            params.node = params.node.split(":")[0];
        }

        await spawnCommandline(`ping -c 4 ${params.node}`);
        return true;
    } catch (error) {
        return false;
    }
}

async function callProxmoxApi(params) {
    try {
        return new Promise(async (resolve, reject) => {
            const { node, path, token, method, allowUnsafeSsl, data } = params;
            const url = `https://${node}/api2/json${path}`;

            try {
                Utils.send_async_request(url, method, data ?? null, token, allowUnsafeSsl, (response) => {
                    Utils._log(`[DEBUG] Response: ${JSON.stringify(response)}`);
                    resolve(response);
                }, (error) => {
                    reject(error);
                });

            } catch (error) {
                reject(error);
            }
        });

    } catch (error) {
        throw error
    }
}

export async function getAllVms(params) {
    // create map to store all vms from all nodes
    let allVms = new Map();

    // get all nodes from proxmox
    let nodes = await callProxmoxApi({
        node: params.node, path: "/nodes",
        token: params.token, method: "GET",
        allowUnsafeSsl: params.allowUnsafeSsl
    });

    // iterate over all nodes
    for (let node of nodes.data) {
        // get all vms from node
        let vms = await callProxmoxApi({
            node: params.node,
            path: `/nodes/${node.node}/qemu`,
            token: params.token,
            method: "GET",
            allowUnsafeSsl: params.allowUnsafeSsl
        });

        if (!allVms.has(node.node)) {
            allVms.set(node.node, []);
        }

        // iterate over all vms
        for (let vm of vms.data) {
            console.log(`[DEBUG] VM: ${JSON.stringify(vm)}`);
            allVms.get(node.node).push(
                new ProxmoxVm(params, node, vm)
            );
        }
    }

    return allVms;
}

/**
 * spawnCommandline runs a shell command and returns its output
 * @param {string} cmdline the command line to spawn
 * @returns {string}       the command output
 * @throws
 */
export async function spawnCommandline(cmdline) {
    const [, argv] = GLib.shell_parse_argv(cmdline);
    const cmd = Gio.Subprocess.new(argv,
        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);

    let [out, err] = await cmd.communicate_utf8_async(null, null);
    const status = cmd.get_exit_status();
    if (status !== 0) {
        throw new Error(`Command terminated with status ${status}: ${err}`);
    }
    return out;
}


class ProxmoxVm {
    constructor(settings, jsonNode, jsonVm) {
        this.nodeId = jsonNode.node;
        this.vmId = jsonVm.vmid;
        this.name = jsonVm.name;
        this.displayName = `${jsonNode.node} - ${jsonVm.vmid} (${jsonVm.name})`;
        this.status = jsonVm.status;
        this.settings = settings;
    }

    async start() {
        await callProxmoxApi(this.settings.node, `/nodes/${this.nodeId}/qemu/${this.vmId}/status/start`, this.settings.token, "POST");
    }

    async stop() {
        await callProxmoxApi(this.settings.node, `/nodes/${this.nodeId}/qemu/${this.vmId}/status/stop`, this.settings.token, "POST");
    }

    async reset() {
        await callProxmoxApi(this.settings.node, `/nodes/${this.nodeId}/qemu/${this.vmId}/status/reset`, this.settings.token, "POST");
    }

    async shutdown() {
        await callProxmoxApi(this.settings.node, `/nodes/${this.nodeId}/qemu/${this.vmId}/status/shutdown`, this.settings.token, "POST");
    }

    async getConfig() {
        return await callProxmoxApi(this.settings.node, `/nodes/${this.nodeId}/qemu/${this.vmId}/config`, this.settings.token, "GET");
    }

    async toString() {
        // get vm details
        let config = await this.getConfig();

        return [
            `Name: ${this.name}`,
            `Status: ${this.status}`,
            `Memory: ${config.data.memory}`,
            `CPUs: ${config.data.cpus}`,
            `OS Type: ${config.data["ostype"]}`
        ].join("\n");
    }
}
