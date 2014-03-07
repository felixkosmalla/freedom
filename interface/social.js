/*globals fdom:true */
/*jslint indent:2,sloppy:true */
/**
 * SOCIAL API
 *
 * API for connecting to social networks and messaging of users.
 * Note that the following properties depend on the specific implementation (provider)
 * behind this API that you choose.
 * An instance of a social provider encapsulates a single user logging into a single network.
 *
 * Variable properties dependent on choice of provider:
 * - Edges in the social network (who is on your roster)
 * - Reliable message passing (or unreliable)
 * - In-order message delivery (or out of order)
 * - Persistent clientId - Whether your clientId changes between logins when
 *    connecting from the same device
 *
 * Invariants across all providers:
 * - The userId for each user does not change between logins
 * - The Social provider should output an 'onUserUpdate' event upon initialization (after constructor)
 *   with its current state.
 *
 * Define a <client_state>, as the following:
 * - Information related to a specific device or client of a user
 * - Use cases: 
 *   - Returned on changes for friends or my instance in 'onClientState'
 *   - Returned in a global list from 'getClients'
 * {
 *   'userId': 'string',    // Unique ID of user (e.g. alice@gmail.com)
 *   'clientId': 'string',  // Unique ID of client (e.g. alice@gmail.com/Android-23nadsv32f)
 *   'status': 'number',    // Status of the client. See the 'STATUS' constants
 *   'timestamp': 'number'  // Timestamp of last received change to <client_state>
 * }
 * 
 * Define a <user_profile>, as the following:
 * - Information related to a specific user (profile information)
 * - Use cases:
 *   - Returned on changes for friends or myself in 'onUserProfile'
 *   - Returned in a global list from 'getUsers'
 * {
 *   'userId': 'string',    // Unique ID of user (e.g. alice@gmail.com)
 *   'name': 'string',      // Name (e.g. Alice Underpants)
 *   'url': 'string',       // Homepage URL
 *   'imageData': 'string', // Data URI of image data (e.g. data:image/png;base64,adkwe329...)
 *   'timestamp': 'number'  // Timestamp of last received change to <user_profile>
 * }
 *
 **/

fdom.apis.set('social', {
  /** 
   * List of error codes that can be returned when a method fails
  **/
  'ERRCODE': {type: 'constant', value: {
    /** GENERAL **/
    // Unknown
    'OFFLINE': 'User is currently offline',
    'UNKNOWN': 'WTF is going on?',

    /** LOGIN **/
    // Error with authenticating to the server
    'LOGIN_BADCREDENTIALS': 'Missing or invalid user credentials',
    // Error with connecting to the server
    'LOGIN_FAILEDCONNECTION': 'Error connecting to the login server',
    // Already logged in
    'LOGIN_ALREADYONLINE': 'User is already logged in',

    /** CLEARCACHEDCREDENTIALS**/
    // None at the moment
    
    /** GETROSTER **/
    // See GENERAL

    /** SENDMESSAGE **/
    'SEND_INVALIDDESTINATION': 'Trying to send a message to an invalid destination',

    /** LOGOUT **/
    // See GENERAL

  }},
  
  /**
   * List of possible statuses in the <state card>
   **/
  'STATUS': {type: 'constant', value: {
    // Not logged in
    'OFFLINE': 0,
    // This client runs the same freedom.js app as you and is online
    'ONLINE': 1,
    // This client is online, but does not run the same app (chat client)
    // (i.e. can be useful to invite others to your freedom.js app)
    'ONLINE_WITH_OTHER_APP': 2
  }},

  /**
   * Stores a list of your userId's
   * NOTE: This is not yet implemented because 'property' is not working
   * e.g. var id = social.id
   **/
  'id': {type: 'property', value: ['string']},

  /**
   * Log into the network (See below for parameters)
   * e.g. social.login(Object options)
   *
   * @method login
   * @param {Object} loginOptions - See below
   * @return {Object} <client_state>
   **/
  'login': {type: 'method', value: [{
    'agent': 'string',    //Name of the application
    'version': 'string',  //Version of application
    'url': 'string',      //URL of application
    'interactive': 'bool', //If true, always prompt for login. If false, try with cached credentials
    'rememberLogin': 'bool' //Cache the login credentials
  }]},

  /**
   * Clears the cached credentials
   * e.g. social.clearCachedCredentials()
   *
   * @method clearCachedCredentials
   * @return nothing
   **/
  'clearCachedCredentials': {type: 'method', value: []},

  /**
   * Returns all the <client_state>s that we've seen so far (from any 'onClientState' event)
   * Note: this instance's own <client_state> will be somewhere in this list
   * Use the clientId returned from social.login() to extract your element
   * NOTE: This does not guarantee to be entire roster, just clients we're currently aware of at the moment
   * e.g. social.getClients()
   * 
   * @method getClients
   * @return {Object} { 
   *    'clientId1': <client_state>,
   *    'clientId2': <client_state>,
   *     ...
   * } List of <client_state>s indexed by clientId
   *   On failure, rejects with an error code (see above)
   **/
  'getClients': {type: 'method', value: []},

  /**
   * Returns all the <user_profile>s that we've seen so far (from 'onUserProfile' events)
   * Note: the user's own <user_profile> will be somewhere in this list. 
   * Use the userId returned from social.login() to extract your element
   * NOTE: This does not guarantee to be entire roster, just users we're currently aware of at the moment
   * e.g. social.getUsers();
   *
   * @method getUsers
   * @return {Object} { 
   *    'userId1': <user_profile>,
   *    'userId2': <user_profile>,
   *     ...
   * } List of <user_profile>s indexed by userId
   *   On failure, rejects with an error code (see above)
   **/
  'getUsers': {type: 'method', value: []},

  /** 
   * Send a message to user on your network
   * If the message is sent to a userId, it is sent to all clients
   * If the message is sent to a clientId, it is sent to just that one client
   * If the destination is not specified or invalid, the message is dropped
   * e.g. sendMessage(String destination_id, String message)
   * 
   * @method sendMessage
   * @param {String} destination_id - target
   * @param {String} message
   * @return nothing
   *  On failure, rejects with an error code (see above)
   **/
  'sendMessage': {type: 'method', value: ['string', 'string']},

  /**
   * Logs out the user of the network
   * e.g. logout()
   * 
   * @method logout
   * @return nothing
   *  On failure, rejects with an error code (see above)
   **/
  'logout': {type: 'method', value: []},

  /**
   * Event on incoming messages
   **/
  'onMessage': {type: 'event', value: {
    'from': {               // message source (fits <client_state>)
      'userId': 'string',   // Unique ID of user (e.g. alice@gmail.com)
      'clientId': 'string', // Unique ID of client (e.g. alice@gmail.com/Android-23nadsv32f)
      'status': 'number',   // Status of the client. See the 'STATUS' constants
      'timestamp': 'number' // Timestamp of last received change to <client_state>
    },
    'to': {                 // message destination (fits <client_state>)
      'userId': 'string',   // Unique ID of user (e.g. alice@gmail.com)
      'clientId': 'string', // Unique ID of client (e.g. alice@gmail.com/Android-23nadsv32f)
      'status': 'number',   // Status of the client. See the 'STATUS' constants
      'timestamp': 'number' // Timestamp of last received change to <client_state>
    },
    'message': 'string'     // message contents
  }},

  /**
   * Event that is sent on changes to a <user_profile> of either yourself
   * or someone on your roster
   * (e.g. if a picture changes)
   * This event must match the schema for an entire <user_profile> (see above)
   * 
   * Clients will include all clients that are |status| !== "OFFLINE"
   * and the most recent client that went OFFLINE
   **/
  'onUserProfile': {type: 'event', value: {
    //REQUIRED
    'userId': 'string',   // Unique ID of user (e.g. alice@gmail.com)
    'timestamp': 'number'  // Timestamp of last received change to <user_profile>
    //OPTIONAL
    'name': 'string',     // Name (e.g. Alice Underpants)
    'url': 'string',      // Homepage URL (e.g. https://alice.com)
    'imageData': 'string',// Data URI of image data (e.g. data:image/png;base64,adkwe329...)
  }},

  /**
   * Event that is sent on changes to your own <client_state>
   * (e.g. You get disconnected)
   **/
  'onClientState': {type: 'event', value: {
    //REQUIRED
    'userId': 'string',   // Unique ID of user (e.g. alice@gmail.com)
    'clientId': 'string', // Unique ID of client (e.g. alice@gmail.com/Android-23nadsv32f)
    'status': 'number',   // Status of the client. See the 'STATUS' constants
    'timestamp': 'number' // Timestamp of last received change to <client_state>
    //OPTIONAL
    //None
  }}

});

