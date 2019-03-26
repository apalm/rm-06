import * as React from "react";
import "./MegaMenu.css";
import { ReactComponent as ArrowRightIcon } from "./svg/baseline-arrow_right-24px.svg";

export class MegaMenu extends React.Component {
  constructor(props) {
    super(props);
    this.container = React.createRef();
  }

  componentDidMount() {
    var navigation = this.container.current,
      x0,
      x1,
      x2,
      x3,
      y0,
      y1,
      y2,
      y3,
      link,
      timeout;

    navigation.addEventListener("mouseenter", onmouseenter);
    navigation.addEventListener("mouseleave", onmouseleave);

    function isInsideTriangle() {
      var b0 = (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1),
        b1 = ((x2 - x0) * (y3 - y0) - (x3 - x0) * (y2 - y0)) / b0,
        b2 = ((x3 - x0) * (y1 - y0) - (x1 - x0) * (y3 - y0)) / b0,
        b3 = ((x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)) / b0;

      return b1 > 0 && b2 > 0 && b3 > 0;
    }

    function onmouseenter(event) {
      document.addEventListener("mousemove", onmousemove);
    }

    function onmouseleave(event) {
      link && link.classList.remove("active");
      document.removeEventListener("mousemove", onmousemove);
    }

    function onmousemove(event) {
      var // get nearest anchor
        linkNominee = event.target.closest("li");

      // set target coords
      x0 = event.clientX;
      y0 = event.clientY;

      if (!linkNominee) {
        clearTimeout(timeout);

        if (link && !link.contains(event.target)) {
          link.classList.remove("active");
          link = null;
        }

        return;
      }

      // conditionally set triangle’s left point
      if (linkNominee === link) {
        if (!isInsideTriangle()) {
          x1 = x0;
          y1 = y0;
        }
      } else if (linkNominee !== link) {
        // end if still inside another link’s triangle
        if (link) {
          if (isInsideTriangle()) {
            clearTimeout(timeout);

            timeout = setTimeout(function() {
              if (link) {
                link.classList.remove("active");

                link = null;
              }

              onmousemove(event);
            }, 200);

            return;
          }

          link.classList.remove("active");
        }

        // set link
        link = linkNominee;

        var next = link.lastElementChild.getBoundingClientRect();

        // set triangle’s left point
        x1 = x0;
        y1 = y0;

        // set triangle’s top point
        x2 = next.left;
        y2 = next.top;

        // set triangle’s bottom point
        x3 = next.left;
        y3 = next.bottom;

        // set link state
        link.classList.add("active");
      }
    }
  }

  render() {
    return (
      <ul className="megaMenu" ref={this.container}>
        {this.props.items.map((item, i) => (
          <li key={i}>
            <a>
              {item.label}
              <ArrowRightIcon />
            </a>
            <div className="megaMenu-subMenu">{item.items}</div>
          </li>
        ))}
      </ul>
    );
  }
}

export { Wrapper, Button, Menu, MenuItem } from "react-aria-menubutton";
