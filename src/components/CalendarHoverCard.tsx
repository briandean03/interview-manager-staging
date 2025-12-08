import { motion } from "framer-motion";

export default function CalendarHoverCard({ date, appointments }: {
  date: string;
  appointments: { time: string; name: string }[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.15 }}
      className="
        absolute z-50 p-3 rounded-lg shadow-lg 
        bg-white border border-gray-200 text-sm 
        w-52
      "
      style={{ top: "-10px", left: "50%", transform: "translate(-50%, -100%)" }}
    >
      <p className="font-semibold text-gray-900 mb-1">{date}</p>

      {appointments.length === 0 ? (
        <p className="text-gray-500 text-xs">No appointments</p>
      ) : (
        <div className="space-y-1">
          {appointments.map((a, idx) => (
            <div key={idx} className="text-xs">
              <p className="font-medium">{a.name}</p>
              <p className="text-gray-600">{a.time}</p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
