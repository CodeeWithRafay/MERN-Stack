const Joi = require( 'joi' );
const User = require( '../models/user' )
const bcrypt = require( 'bcryptjs' )
const UserDTO = require( '../dto/user' );
const JWTService = require( '../services/JWTService' );
const RefreshToken = require( '../models/token' );

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,25}$/;
const authController = {
    async register ( req, res, next ) {
        // 1. Validate user input
        const userRegisterSchema = Joi.object( {
            username: Joi.string().min( 5 ).max( 30 ).required(),
            name: Joi.string().max( 30 ).required(),
            email: Joi.string().email().required(),
            password: Joi.string().pattern( passwordPattern ).required(),
            confirmPassword: Joi.ref( 'password' )
        } )

        const { error } = userRegisterSchema.validate( req.body );

        // 2. if error in validation -> return error via middleware
        if ( error ) {
            return next( error );
        }

        // 3. if email or username is already registered -> return an error
        const { username, name, email, password } = req.body;

        // check if email is not already registered

        try {
            const emailInUse = await User.exists( { email } );

            const usernameInUse = await User.exists( { username } );

            if ( emailInUse ) {
                const error = {
                    status: 409,
                    message: 'Email Already Registered'
                }
                return next( error );
            }

            if ( usernameInUse ) {
                const error = {
                    status: 409,
                    message: "Username not available"
                }
                return next( error );
            }
        } catch ( error ) {
            return next( error );
        }

        //4. Password hash
        const hashedPassword = await bcrypt.hash( password, 10 );

        // 5. store user data in db   
        let accessToken;
        let refreshToken;
        let user;
        try {
            const userToRegister = new User( {
                username,
                email,
                name,
                password: hashedPassword,

            } )

            user = await userToRegister.save(); // saving the user in the database.

            // token generation
            accessToken = JWTService.signAccessToken( { _id: user._id }, '30m' );

            refreshToken = JWTService.signRefreshToken( { _id: user._id }, '60m' )
        } catch ( error ) {
            return next( error );
        }

        // Store refresh Token in database
        await JWTService.storeRefreshToken( refreshToken, user._id )

        // send tokens in cookies

        res.cookie( 'accessToken', accessToken, {
            maxAge: 1000 * 60 * 60 * 24,
            httpOnly: true // XSS
        } );

        res.cookie( 'refreshToken', refreshToken, {
            maxAge: 1000 * 60 * 60 * 24,
            httpOnly: true // XSS
        } );

        // 6. Response send

        const userDto = new UserDTO( user );

        return res.status( 201 ).json( { user: userDto, auth: true } );
    },
    async login ( req, res, next ) {
        // console.log( req )
        const userLoginSchema = Joi.object( {
            username: Joi.string().min( 5 ).max( 30 ).required(),
            password: Joi.string().pattern( passwordPattern ).required()
        } );

        const { error } = userLoginSchema.validate( req.body );

        if ( error ) {
            return next( error )
        }

        const { username, password } = req.body;

        // define to use it outside the scope
        let user;
        try {
            user = await User.findOne( { username: username } );

            if ( !user ) {
                const error = {
                    status: 401,
                    message: 'Invalid Username'
                }

                return next( error );
            }

            // match password
            // req.body.password -> hash -> match
            const match = await bcrypt.compare( password, user.password );


            if ( !match ) {
                const error = {
                    status: 401,
                    message: "Invalid Password"
                }

                return next( error );


            }

        } catch ( error ) {
            return next( error )
        }

        const accessToken = JWTService.signAccessToken( { _id: user._id }, '30m' );
        const refreshToken = JWTService.signRefreshToken( { _id: user._id }, '60m' );

        // update refresh token in database

        try {

            await RefreshToken.updateOne( {
                _id: user._id,
            },
                {
                    token: refreshToken
                },
                { upsert: true } )
        } catch ( error ) {
            return next( error )
        }


        res.cookie( 'accessToken', accessToken, {
            maxAge: 1000 * 60 * 60 * 24,
            httpOnly: true
        } )
        res.cookie( 'refreshToken', refreshToken, {
            maxAge: 1000 * 60 * 60 * 24,
            httpOnly: true
        } );



        const userDto = new UserDTO( user );
        return res.status( 200 ).json( { user: userDto, auth: true } );
    },
    async logout ( req, res, next ) {

        //1. delete refresh token from db
        const { refreshToken } = req.cookies;

        try {
            await RefreshToken.deleteOne( { token: refreshToken } );
        } catch ( error ) {
            return next( error );
        }

        // delete cookies
        res.clearCookie( 'accessToken' );
        res.clearCookie( 'refreshToken' );

        //2. response
        res.status( 200 ).json( { user: null, auth: false } );
    },
    async refresh ( req, res, next ) {
        //1.  get refreshToken from cookies
        //2. verify refreshToken
        //3. generate new tokens
        //4. update db, return response

        const originalRefreshToken = req.cookies.refreshToken;

        let id;
        try {
            id = JWTService.verifyRefreshToken( originalRefreshToken )._id;
        } catch ( e ) {
            const error = {
                status: 401,
                message: "Unauthorized"

            }
            return next( error );
        }

        try {
            const match = RefreshToken.findOne( { _id: id, token: originalRefreshToken } );

            if ( !match ) {
                const error = {
                    status: 401,
                    message: "Unauthorized"
                }
                return next( error );
            }
        } catch ( e ) {
            return next( e );
        }

        try {
            const accessToken = JWTService.signAccessToken( { _id: id }, '30m' );
            const refreshToken = JWTService.signRefreshToken( { _id: id }, '60m' );

            await RefreshToken.updateOne( { _id: id }, { token: refreshToken } )

            res.cookie( 'accessToken', accessToken, {
                maxAge: 1000 * 60 * 60 * 24,
                httpOnly: true,
            } );
            res.cookie( 'refreshToken', refreshToken, {
                maxAge: 1000 * 60 * 60 * 24,
                httpOnly: true,
            } );
        } catch ( error ) {
            return next(error)
        }

        const user = await User.findOne({_id:id});

        const userDto = new UserDTO(user);

        return res.status(200).json({user:userDto,auth:true})
    }


}


module.exports = authController;

