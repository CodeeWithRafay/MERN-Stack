const express = require( 'express' );
const dbConnect = require( './database/index' );
const router = require( './routes/index' );
const { PORT } = require( './config/index' );
const errorHandler = require( './middlewares/errorHandler' );
const cookieParser = require( 'cookie-parser' );

const app = express()

// MiddleWares
app.use( cookieParser() )
app.use( express.json() );
app.use('/storage',express.static('storage'));

app.use( router );

dbConnect();

app.use( errorHandler );

app.listen( PORT, () => {
  console.log( `Example app listening on port http://localhost:${PORT}` );
} );

