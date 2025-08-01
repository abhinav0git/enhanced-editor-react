import React from 'react';

const ContextMenu = ({ position, onAction, onClose }) => {
  // This effect adds a one-time click listener to the window to close the menu
  // when the user clicks anywhere else on the page.
  React.useEffect(() => {
    console.log("✅ [COMPONENT] ContextMenu has mounted!");
    const handleClickOutside = () => {
      console.log("... Clicked outside, closing menu.");
      onClose();
    };
    // A short timeout is used to prevent the same click that opened the menu
    // from immediately closing it.
    const timer = setTimeout(() => {
        window.addEventListener('click', handleClickOutside);
    }, 10);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleClickOutside);
    };
  }, [onClose]);

  // Style object to position the menu at the cursor's coordinates.
  const menuStyle = {
    top: `${position.y + 110}px`,
    left: `${position.x + 440}px`,
  };

  // This stops the click on a menu item from closing the menu immediately.
  const handleMenuClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div className="context-menu" style={menuStyle} onClick={handleMenuClick}>
      <button className="context-menu-item" onClick={() => onAction('bringFront')}>Bring Front</button>
      <button className="context-menu-item" onClick={() => onAction('sendBack')}>Send Back</button>
      <button className="context-menu-item" onClick={() => onAction('duplicate')}>Duplicate</button>
      <button className="context-menu-item danger" onClick={() => onAction('delete')}>Delete</button>
    </div>
  );
};

export default ContextMenu;
