import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  extendTheme,
  ChakraProvider,
} from "@chakra-ui/react";
import { RouterProvider, createBrowserRouter } from "react-router-dom";

// Import the layouts
import RootLayout from "./layouts/root-layout";
import DashboardLayout from "./layouts/dashboard-layout";
import AdminLayout from "./layouts/admin-layout";

// Import the components
import IndexPage from "./routes";
import SignInPage from "./routes/sign-in";
import SignUpPage from "./routes/sign-up";
import DashboardPage from "./routes/dashboard";
import AdminPage from "./routes/admin";
import HudsPage from "./routes/huds";
import NotFoundPage from "./routes/not-found";
import KnowledgeBasePage from "./routes/knowledgebase";

const config = {
  initialColorMode: "dark",
};

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: "/", element: <IndexPage /> },
      { path: "/sign-in/*", element: <SignInPage /> },
      { path: "/sign-up/*", element: <SignUpPage /> },
      { path: "/thanks/*", element: <></> },
      { path: "/success/*", element: <>Todo</> },
      { path: "/cancel/*", element: <>Todo</> },
      {
        element: <HudsPage />,
        path: "/huds"
      },
      {
        element: <HudsPage />,
        path: "/huds/:hudId"
      },
      {
        element: <DashboardLayout />,
        path: "dashboard",
        children: [{ path: "/dashboard", element: <DashboardPage /> }],
      },
      {
        element: <AdminLayout />,
        path: "admin",
        children: [{ path: "/admin", element: <AdminPage /> }],
      },
      {
        element: <KnowledgeBasePage />,
        path: "/knowledge-base"
      },
    ],
    errorElement: <NotFoundPage />
  },
]);

const theme = extendTheme({ config });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChakraProvider theme={theme}>
      <RouterProvider router={router} />
    </ChakraProvider>
  </StrictMode>
);
