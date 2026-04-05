import Widget from "../components/Widget";

export default function WidgetEmbedPage() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-transparent">
      <Widget embedded />
    </div>
  );
}
