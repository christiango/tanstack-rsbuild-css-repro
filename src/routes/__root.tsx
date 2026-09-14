import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import "./root.css";

export const Route = createRootRoute({ component: Root });

function Root() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <nav aria-label="Routes">
          <Link to="/">Home</Link>
          <Link to="/alpha">Alpha</Link>
          <Link to="/beta">Beta</Link>
        </nav>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
