/*
 *  BME680 - Temperature/Humidity/Pressure/Gas sensor
 *  A TypeScript implementation for interfacing with the BME680 environmental sensor via I2C.
 * 
 *  by Sanne 'SpuQ' Santens, late 2024
 */

// Register addresses
const BME680_REG_STATUS = 0x73;         // Status register
const BME680_REG_CTRL_MEAS = 0x74;      // Control register
const BME680_REG_CTRL_HUM = 0x72;       // Humidity control
const BME680_REG_CONFIG = 0x75;         // Configuration
const BME680_REG_DATA = 0x1F;           // Start of measurement data block


export default class BME680 {
    private i2c_address:number|null = null;
    private i2c_interface:any|null = null;

    constructor( i2c_address:number, i2c_interface:any){
        this.i2c_address=i2c_address;
        this.i2c_interface=i2c_interface;

        // Initialize the BME680
        this.init();
    }

    // Function to write a byte to the sensor
    private writeByte(register: number, value: number): void {
        this.i2c_interface.writeByteSync(this.i2c_address, register, value);
    }

    // Function to read a block of bytes from the sensor
    private readBlock(register: number, length: number): Buffer {
        const buffer = Buffer.alloc(length);
        this.i2c_interface.readI2cBlockSync(this.i2c_address, register, length, buffer);
        return buffer;
    }

    // Initialize the BME680
    private init(): void {
        try{
            // Set humidity oversampling (1x)
            this.writeByte(BME680_REG_CTRL_HUM, 0x01);
            // Set temperature and pressure oversampling (1x), sensor mode (forced)
            this.writeByte(BME680_REG_CTRL_MEAS, 0x27);
            // Configure the sensor (standby time, filter, etc.)
            this.writeByte(BME680_REG_CONFIG, 0x10);
        }
        catch(e){
            console.error("Failed to initialize BME680: "+e);
        }
    }

    // Read all sensor values
    public readSensorData(): any {
        const data = this.readBlock(BME680_REG_DATA, 15); // 15 bytes of measurement data
  
        // Parse data from the buffer (refer to datasheet for exact layout)
        const rawTemperature = (data[3] << 12) | (data[4] << 4) | (data[5] >> 4);
        const rawPressure = (data[0] << 12) | (data[1] << 4) | (data[2] >> 4);
        const rawHumidity = (data[6] << 8) | data[7];
  
        // Compensation formulas to convert raw data to human-readable values
        const temperature = rawTemperature / 100; // Example conversion
        const pressure = rawPressure / 100; // Example conversion
        const humidity = rawHumidity / 1024; // Example conversion
  
        console.log(`Temperature: ${temperature.toFixed(1)} °C`);
        console.log(`Pressure: ${pressure.toFixed(1)} hPa`);
        console.log(`Humidity: ${humidity.toFixed(1)} %`);

        return {temperature:temperature.toFixed(1), humidity:humidity.toFixed(1), pressure:pressure.toFixed(1)};
    }
}