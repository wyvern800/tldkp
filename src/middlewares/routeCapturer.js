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

  const originalRouterPut = apiRouter.put.bind(apiRouter);
  apiRouter.put = (path, handler, description) => {
    captureRoute("PUT", path, description || "No description provided");
    return originalRouterPut(path, handler);
  };

  const originalRouterDelete = apiRouter.delete.bind(apiRouter);
  apiRouter.delete = (path, handler, description) => {
    captureRoute("DELETE", path, description || "No description provided");
    return originalRouterDelete(path, handler);
  };
}

export function getRoutes() {
  return routes;
}