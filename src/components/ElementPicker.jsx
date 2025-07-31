import React from 'react';

const ElementPicker = ({ elements, position, onSelect, onHover, onMouseLeave }) => {
    if (!elements || elements.length === 0) {
        return null;
    }
    
    // Position the popup, ensuring it doesn't go off-screen
    const style = {
      display: 'block',
      left: Math.min(position.x, window.innerWidth - 320) + 'px',
      top: Math.min(position.y, window.innerHeight - 200) + 'px'
    }

    return (
        <div className="element-picker-popup" style={style}>
            <h4>Select Element</h4>
            <ul className="element-picker-list">
                {elements.map(({el, path}, index) => {
                    const tagName = el.tagName.toLowerCase();
                    const className = el.className ? `.${el.className.split(' ').join('.')}` : '';
                    const id = el.id ? `#${el.id}` : '';

                    return (
                        <li 
                          key={path}
                          className="element-picker-item" 
                          onClick={() => onSelect(el)}
                          onMouseEnter={() => onHover(el)}
                          onMouseLeave={onMouseLeave}
                        >
                            <div className="tag-name">{tagName}{id}{className}</div>
                        </li>
                    )
                })}
            </ul>
        </div>
    );
};

export default ElementPicker;
