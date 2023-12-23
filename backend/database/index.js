const mongoose = require( 'mongoose' );
const { MONGODB_CONNECTION_STRING } = require( "../config/index" )

// Function to connect with database
const dbConnect = async () => {
    // use try catch when connecting with database
    try {
        const conn = await mongoose.connect( MONGODB_CONNECTION_STRING );
        console.log( `Database Connected : ${conn.connection.host}` );
    }
    catch ( error ) {
        console.log( `Database Connection Error: ${error}` );
    }
}

module.exports = dbConnect;



