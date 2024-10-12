/*
 *  Freya hardware
 *  The hardware-dependent component of the Freya Vivarium Control System, designed
 *  for use with the Edgeberry hardware (Base Board + Sense'n'Drive hardware cartridge)
 *  and the BME280 (barometric pressure, relative humidity, temperature) and BH1750 (light intensity)
 *  I2C sensors.
 *
 *  by Sanne 'SpuQ' Santens
 */
const dbus = require('dbus-native');
const BH1750 = require('bh1750-sensor');
const BME280 = require('bme280-sensor');
import { exec } from 'child_process'; 


// BH1750 setup
const bh1750 = new BH1750({
    address: 0x23,    // BH1750 I2C address
    mode: BH1750.CONTINUOUS_HIGH_RES_MODE, // Correct mode constant
    device: '/dev/i2c-1'
});

// BME280 setup
const bme280 = new BME280({
    i2cBusNo: 1,      // I2C bus number
    i2cAddress: 0x77  // BME280 I2C address (updated to 0x77)
});

const SERVICE_NAME="io.freya.Core";
const SIGNAL_NAME="updateActuator";

const GPIO_LIGHTS="21";       // Digital out 1
const GPIO_HEATER="20";       // Digital out 2
const GPIO_RAIN="16";         // Digital out 3
const GPIO_TLIGHTS="18";      // Digital out 6 - Transitional lights

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

/*
 *  Sensors
 */

// Initialize the I2C sensors
async function initializeSensors() {
    try {
        await bh1750.init();
        console.log('BH1750 initialized');
    } catch (err) {
        console.error('Failed to initialize BH1750:', err);
    }

    try{
        await bme280.init();
        console.log('BME280 initialized');
    } catch (err) {
        console.error('Failed to initialize BME280:', err);
    }
}

initializeSensors();

// Read the sensor values continuously
setInterval(async()=>{
    // Read the BH1750 data
    try {
        const lux = await bh1750.readData();
        console.log(`Light Intensity: ${lux.toFixed(1)} Lux`);
        // Pass relative light intensity to Freya Core. With my current lighting setup,
        // 5500 Lux is the maximum, that's why I devide by 55 to get a percentage, but this should
        // get a better implementation (e.g. with a calibration function)
        if(freyaCore) freyaCore.setMeasurement(JSON.stringify({variable:'lighting', value:(lux/55).toFixed(1)}));

    }catch(err){
        console.error('Error reading BH1750 sensor:', err);
    }
    // Read BME280 data
    try{
        const data = await bme280.readSensorData();
        // Extract data
        const temperature = data.temperature_C;
        const pressure = data.pressure_hPa;
        const humidity = data.humidity;

        console.log("Temperature"+ temperature.toFixed(1) +" °C");
        if(freyaCore) freyaCore.setMeasurement(JSON.stringify({variable:'temperature', value:temperature.toFixed(1)}));
        console.log("Pressure: "+ pressure.toFixed(1) +" hPa");
        if(freyaCore) freyaCore.setMeasurement(JSON.stringify({variable:'pressure', value:pressure.toFixed(1)}));
        console.log("Humidity: "+ humidity.toFixed(1) +" %");
        if(freyaCore) freyaCore.setMeasurement(JSON.stringify({variable:'humidity', value:humidity.toFixed(1)}));
    } catch (err) {
        console.error('Error reading BME280 sensor:', err);
    }
}, 2*1000);


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
                case 'translights':  setDigitalOutput( GPIO_TLIGHTS, actuatorData.value );
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