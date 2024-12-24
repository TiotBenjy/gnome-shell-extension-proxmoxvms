![Project Icon](src/proxmox-icon.png)
# GNOME Shell Extension: ProxmoxVms

**Manage ProxmoxVE VMs & containers seamlessly within the GNOME Shell.**

Status: Under Development

*This extension is not affiliated with the Proxmox project.*
  
## Extension features 

This extension provides a convenient GNOME Shell menu to manage your Proxmox environnement containers. 

Supported actions include:

- **Start**: Initialize VMs & containers ;
- **Stop**: Terminate running VMs & containers ;
- **Remove**: Delete VMs & containers ;
- **Pause**: Suspend VMs & containers ;
- **Restart**: Reboot VMs & containers ;
- **Live Stats**: View real-time statistics in the extension.

## Installation

### From Source

1. **Clone the repository:**
   ```bash
   git clone https://github.com/tiotbenjy/gnome-shell-extension-proxmoxvms
   cd gnome-shell-extension-proxmoxvms
   ```
   
2. Build and install:

  ```bash
  make all
  ```

**Attention** : If you use Wayland as destop manager don't forget to reload the environnement before enable the extension.


3. Enable the extension:

  ```bash
  make enable
  ```

Alternatively, enable it via Extensions -> Toggle 'Containers'.


## Preferences

- __*general*__

|       Key        |                      Description                       | Default value |
| :--------------: | :----------------------------------------------------: | :-----------: |
| refresh-interval | Time (in minutes) to refresh the VMs & containers list |       1       |
| allow-unsafe-ssl | Allow unsafe SSL certificates (for self signed certs)  |     false     |


- __*proxmox*__

|     Key      |     Description      |    Default value     |
| :----------: | :------------------: | :------------------: |
|   pve-host   |  Proxmox server URL  | pve.example.com:8006 |
| api-token-id | Proxmox API token ID | root@pam!gnome-shell |
|  api-secret  |  Proxmox API secret  |                      |


## Development & Contributing

To contribute to the development of this extension:

Clone the repository and make your changes.

Debugging: Spin up an inline GNOME Shell session in a dedicated window:
  
```bash
  make debug
```

Contributions are welcome! Please ensure your code is thoroughly tested before submitting a pull request.

## Thanks

Thanks to the projects that made this one possible (ideas & code):

- [gnome-shell-extension-containers](https://github.com/rgolangh/gnome-shell-extension-containers)
- [hass-gshell-extension](https://github.com/geoph9/hass-gshell-extension)


## License

Apache-2.0 License
