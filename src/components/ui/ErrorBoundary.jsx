import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="empty-state" style={{ paddingTop: 120 }}>
          <div className="empty-state-text">
            Da xay ra loi. Vui long tai lai trang.
          </div>
          <button
            className="btn btn-primary"
            style={{ marginTop: 16 }}
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
          >
            Tai lai
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
