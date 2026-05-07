import { STATUS_DOT, GREEN, GOLD, ORANGE, RED } from "./constants.js";

export const todayStr = () => new Date().toISOString().split("T")[0];

export const isAdminRole = (role) => role === "admin" || role === "co-admin";

/**
 * Calcule la couleur d'urgence d'une tâche personnelle.
 * schedulingState = { todayIds, tomorrowIds, todayDates }
 * tomorrowIds est un tableau d'objets { id, addedDate }
 */
export const taskColor = (task, { todayIds = [], tomorrowIds = [], todayDates = {} } = {}) => {
  if (!task || task.status === "Terminé") return null;
  const today = todayStr();
  const tom = new Date(); tom.setDate(tom.getDate() + 1);
  const tomorrow = tom.toISOString().split("T")[0];
  const inTom = tomorrowIds.map(e => e.id).includes(task.id);
  if (task.due) {
    if (task.due < today) return RED;
    if (task.due === today) return GOLD;
    if (todayIds.includes(task.id)) return GOLD;
    if (task.due === tomorrow || inTom) return ORANGE;
    return GREEN;
  }
  if (inTom) return ORANGE;
  if (todayIds.includes(task.id)) {
    const added = todayDates[task.id];
    return (!added || added === today) ? GOLD : RED;
  }
  return null;
};

/**
 * Calcule la couleur d'urgence d'une tâche équipe.
 * Utilise scheduledFor au lieu de todayIds/tomorrowIds.
 */
export const teamTaskColor = (task) => {
  if (!task || task.status === "Terminé") return null;
  const today = todayStr();
  const tom = new Date(); tom.setDate(tom.getDate() + 1);
  const tomorrow = tom.toISOString().split("T")[0];
  const sfDate = task.scheduledFor && task.scheduledFor !== "today" && task.scheduledFor !== "tomorrow"
    ? task.scheduledFor : null;
  const refDate = task.due || sfDate;
  if (refDate) {
    if (refDate < today) return RED;
    if (refDate === today || task.scheduledFor === "today") return GOLD;
    if (refDate === tomorrow || task.scheduledFor === "tomorrow") return ORANGE;
    return GREEN;
  }
  if (task.scheduledFor === "today")    return GOLD;
  if (task.scheduledFor === "tomorrow") return ORANGE;
  return null;
};

/**
 * Génère l'objet completion d'une tâche au moment où elle passe à "Terminé".
 * schedulingState = { todayIds, tomorrowIds, todayDates }
 */
export const buildCompletion = (task, schedulingState = {}) => {
  const now   = new Date();
  const tc    = taskColor(task, schedulingState);
  const color = tc ? tc.light : STATUS_DOT["Terminé"];
  let deltaMin = null, deltaLabel = null;
  if (task.due) {
    const dueMs = new Date(task.due + "T23:59:59").getTime();
    deltaMin = Math.round((now.getTime() - dueMs) / 60000);
    const abs = Math.abs(deltaMin), d = Math.floor(abs / 1440), h = Math.floor((abs % 1440) / 60), m = abs % 60;
    const parts = []; if (d) parts.push(d + "j"); if (h) parts.push(h + "h"); if (m || !parts.length) parts.push(m + "min");
    deltaLabel = (deltaMin < 0 ? "−" : "+") + parts.join(" ");
  }
  return { doneAt: now.toISOString(), doneDate: now.toISOString().split("T")[0], color, deltaMin, deltaLabel };
};
