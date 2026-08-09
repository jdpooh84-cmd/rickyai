import "@testing-library/jest-dom";

// server-only throws if imported outside Next.js server context; mock it for unit tests
vi.mock("server-only", () => ({}));
