// Step 1: Array to hold route definitions
const routes = [];

// Middleware to capture route information
const captureRoute = (method, path, description) => {
  routes.push({ method, path: `/api${path}`, description });
};

/**
 * Parses the route
 * 
 * @param { any } apiRouter 
 */
export function parseRoutes(apiRouter) {
  // Override the apiRouter methods to capture the routes
  const originalRouterGet = apiRouter.get.bind(apiRouter);
  apiRouter.get = (path, handler, description) => {
    captureRoute("GET", path, description || "No description provided");
    return originalRouterGet(path, handler);
  };

  const originalRouterPost = apiRouter.post.bind(apiRouter);
  apiRouter.post = (path, handler, description) => {
    captureRoute("POST", path, description || "No description provided");
    return originalRouterPost(path, handler);
  };
}

export function getRoutes() {
  return routes;
}