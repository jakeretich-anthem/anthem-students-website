import AdminChrome from "../../components/AdminChrome";
import NotesPaste from "./NotesPaste";

export default function AdminNewWeekPage() {
  return (
    <AdminChrome active="this-week">
      <NotesPaste />
    </AdminChrome>
  );
}
