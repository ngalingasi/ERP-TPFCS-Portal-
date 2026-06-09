/**
 * HOW TO REGISTER THE ERP ROUTE IN PROJECT MANAGEMENT
 * ─────────────────────────────────────────────────────
 * File: src/routes/v1/index.js
 *
 * Add the following import at the top with the other route requires:
 *
 *   const erpRoute = require('./erp.route');             // ← ADD THIS
 *
 * Then inside the defaultRoutes array add:
 *
 *   { path: '/erp', route: erpRoute },                  // ← ADD THIS
 *
 * Full example of the updated defaultRoutes array:
 *
 *   const defaultRoutes = [
 *     { path: '/auth',       route: authRoute },
 *     { path: '/users',      route: userRoute },
 *     { path: '/projects',   route: projectRoute },
 *     { path: '/objectives', route: objectiveRoute },
 *     { path: '/targets',    route: targetRoute },
 *     { path: '/activities', route: activityRoute },
 *     { path: '/documents',  route: documentRoute },
 *     { path: '/lookups',    route: lookupRoute },
 *     { path: '/budget',     route: budgetRoute },
 *     { path: '/activities/:activityId/payments', route: paymentRoute },
 *     { path: '/financial',       route: financialRoute },
 *     { path: '/inventory',       route: inventoryRoute },
 *     { path: '/purchase-orders', route: poRoute },
 *     { path: '/inspection',      route: inspectionRoute },
 *     { path: '/transfers',       route: transferRoute },
 *     { path: '/logistics',       route: logisticsRoute },
 *     { path: '/erp',             route: erpRoute },    // ← ADD THIS
 *   ];
 *
 * ─────────────────────────────────────────────────────
 * Add to .env:
 *   ERP_SECRET=CHANGE_THIS_PROJ_SECRET_BEFORE_DEPLOY
 *
 * This value must match the erp_secret stored for this profile
 * in the ERP portal's software_profiles table.
 * ─────────────────────────────────────────────────────
 */
