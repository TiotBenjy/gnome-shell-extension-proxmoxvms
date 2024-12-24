VERSION ?= $(shell git describe --tags --always)
TARGET_FILE := proxmoxvms@tiotbenjy.shell-extension_$(VERSION).zip
EXTRA_SOURCES = \
	--extra-source=proxmox-icon.png \
	--extra-source=classic.css \
	--extra-source=modules

build:
	gnome-extensions pack -f $(EXTRA_SOURCES) src/
	mv proxmoxvms@tiotbenjy.shell-extension.zip $(TARGET_FILE)

install: build
	gnome-extensions install -f $(TARGET_FILE)

enable:
	gnome-extensions enable proxmoxvms@tiotbenjy

debug:
	G_MESSAGES_DEBUG="GNOME Shell" dbus-run-session -- gnome-shell --nested --wayland

lint:
	npm run lint

all: \
	install \
	enable

.PHONY: build debug enable install all lint

