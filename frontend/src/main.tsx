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
import GuildImportPage from "./routes/guild-import";
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
      { path: "/sign-in", element: <SignInPage /> },
      { path: "/sign-up", element: <SignUpPage /> },
      { path: "/thanks", element: <div>Thanks page</div> },
      { path: "/success", element: <div>Success page</div> },
      { path: "/cancel", element: <div>Cancel page</div> },
      /*{
        element: <HudsPage />,
        path: "/huds"
      }
      {
        element: <HudsPage />,
        path: "/huds/:hudId"
      },*/
      {
        element: <DashboardLayout />,
        path: "/dashboard",
        children: [{ path: "/dashboard", element: <DashboardPage /> }],
      },
      {
        element: <AdminLayout />,
        path: "/admin",
        children: [{ path: "/admin", element: <AdminPage /> }],
      },
      {
        element: <KnowledgeBasePage />,
        path: "/knowledge-base"
      },
      {
        element: <GuildImportPage />,
        path: "/guild/:guildId/import"
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
