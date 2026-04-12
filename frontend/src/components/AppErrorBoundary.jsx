import { Component } from "react";

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Route render failed", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-main-surface flex min-h-screen items-center justify-center p-6">
          <div className="app-detail-card max-w-md p-6 text-center">
            <h1 className="text-xl font-bold" style={{ color: "var(--app-text)" }}>
              Something went wrong
            </h1>
            <p className="mt-3 text-sm" style={{ color: "var(--app-text-muted)" }}>
              {this.props.routeName
                ? `The ${this.props.routeName} view failed to load.`
                : "This view failed to load."}
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="app-primary-button mt-5"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
