#!/bin/bash

##
#   uninstall.sh
#   Uninstall the software package
#
#   by Sanne 'SpuQ' Santens
##

APPNAME=Freya
APPCOMP=HardwareInterface
APPDIR=/opt/${APPNAME}/${APPCOMP}


# Start a clean screen
clear;

# Check if this script is running as root. If not, notify the user
# to run this script again as root and exit
if [ "$EUID" -ne 0 ]; then
    echo -e "\e[0;31mUser is not root. Exit.\e[0m"
    echo -e "\e[0mRun this script again as root\e[0m"
    exit 1;
fi

# Prompt the user if they are sure they want to uninstall
# the software
read -r -p "Delete the $APPNAME $APPCOMP software? [y/N]: " response
case "$response" in
    [yY])
        ;;
    *) 
        exit 0;
        ;;
esac

# Delete the Edgeberry software directory
echo -n -e "\e[0mDeleting the $APPNAME $APPCOMP software... \e[0m"
rm -rf $APPDIR
echo -e "\e[0;32m[Done] \e[0m";

# Stop the systemd service
systemctl stop io.freya.$APPCOMP
systemctl daemon-reload

# Delete systemd service file for Freya-core
echo -n -e "\e[0mDeleting the $APPNAME $APPCOMP systemd service... \e[0m"
rm  /etc/systemd/system/io.freya.$APPCOMP.service
echo -e "\e[0;32m[Done] \e[0m";

# Done uninstalling
echo -e "The $APPNAME $APPCOMP software was successfully removed"
exit 0;