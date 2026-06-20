import express from "express";
import dotenv from "dotenv";


import airportRoutes from "./routes/airport.js";
import hotelRoutes from "./routes/hotel.js";
import beachRoutes from "./routes/beach.js";
import publicRoutes from "./routes/public.js";
import announcementRoutes from "./routes/announcement.js";
import parrotRoutes from "./routes/parrot.js";
import eventRoutes from "./routes/events.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health probe for the gateway's aggregate /health check.
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/events/", eventRoutes);
app.use("/airport/", airportRoutes);
app.use("/hotel/", hotelRoutes);
app.use("/beach/", beachRoutes);
app.use("/public/", publicRoutes);
app.use("/announcement/", announcementRoutes);
app.use("/parrot/", parrotRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});