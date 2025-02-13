import { NextFunction, Request, Response } from "express";

/**
 *
 * Checks for authentication as well as authorization of a request, returns 403 if not authenticated/authorized
 * @example
 * // Example Usage
 * authorizationChecker("admin"); // for only admin accessible routes
 * authorizationChecker(); // for user accessible routes
 * authorizationChecker("user"); // for user accesible routes
 *
 */
export default function authorizationChecker(
  requiredRole: "user" | "admin" = "user",
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;

    if (!userRole || userRole !== requiredRole) {
      return res.status(403).json({ message: "access denied" });
    }
    next();
  };
}
