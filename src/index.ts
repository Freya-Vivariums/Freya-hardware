/*
 *  Freya Legacy Hardware
 *
 *  by Sanne 'SpuQ' Santens
 */

const Qdevice = require('qdevice');
const dbus = require('dbus-native');
import { exec } from 'child_process'; 

const SERVICE_NAME="io.freya.Core";
const SIGNAL_NAME="updateActuator";

const GPIO_LIGHTS="21";       // Digital out 1
const GPIO_HEATER="20";       // Digital out 2
const GPIO_RAIN="16";         // Digital out 3

/* GPIO controls for the Sense'n'Drive Cartridge digital outputs */
function setDigitalOutput( digitalOutput:string, state:string ){
    const digitalState = state==='on'?'dh':'dl';
    try{
        exec("pinctrl set "+digitalOutput+" op "+digitalState);
    }
    catch(e){
        console.log("Failed to set Digital Output: "+e);
    }
}

/* System DBus client */
const systemBus = dbus.systemBus();
let freyaCore:any|null;

function subscribeToFreyaCore(){
    // Listen for signals from Freya Core
    systemBus.getService('io.freya.Core').getInterface( '/io/freya/Core', 
                                                        'io.freya.Core',
                                                        (err:any, iface:any)=>{
                                                            if(err) return console.log(err);
                                                            freyaCore = iface;
                                                            freyaCore.on(SIGNAL_NAME, setActuator );
                                                        }
    );
}

// initial subscription
subscribeToFreyaCore();

// Function to handle Freya Core service restart
// by listening to NameOwnerChanged signal
function monitorService() {
    systemBus.getService('org.freedesktop.DBus').getInterface(
        '/org/freedesktop/DBus',
        'org.freedesktop.DBus',
        (err:any, iface:any) => {
            if (err) return console.error('Failed to get DBus interface:', err);
            iface.on('NameOwnerChanged', (name:string, oldOwner:string, newOwner:string) => {
                if (name === SERVICE_NAME) {
                    if (oldOwner && !newOwner) {
                        console.log('Service has stopped. Removing event listeners from interface');
                        if(freyaCore) freyaCore.off(SIGNAL_NAME);
                    } else if (!oldOwner && newOwner) {
                        console.log('Service has started.');
                        subscribeToFreyaCore(); // Re-subscribe to signals
                    }
                }
            });
        }
    );
}

monitorService();

/* Q-com based hardware devices */
const powerSwitch = new Qdevice("FreyaPowerswitch_1");		// Freya's Powerswitch Module, on address 1
const sensor = new Qdevice("freyaSensor_1");		        // Freya's Sensor Module, on address 1

// When data is received from the physical sensor,
// update the data to the Freya Core
sensor.on('data', function( data:any ){
    console.log(data);
    if(freyaCore) freyaCore.setMeasurement(JSON.stringify({variable:data.signal, value:parseFloat(data.argument)}))
});

// When actuator data is received from the
// Freya Core, update the physical actuators
function setActuator( data:string ){
        console.log(data)
        try{
            // Parse the data to JSON
            const actuatorData = JSON.parse(data);

            switch(actuatorData.actuator){
                case 'lights':  setDigitalOutput( GPIO_LIGHTS, actuatorData.value );
                                break;
                case 'rain':    setDigitalOutput( GPIO_RAIN, actuatorData.value );
                                break;
                case 'heater':  setDigitalOutput( GPIO_HEATER, actuatorData.value );
                                break;
                default: break;
            }
        }
        catch( err ){
            console.error("Unable to parse actuator data!");
        }
}