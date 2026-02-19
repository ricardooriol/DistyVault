import React from 'react';
import Modal from '@/components/ui/Modal';

export default function ErrorModal({ item, onClose }) {
    return (
        <Modal open={!!item} onClose={onClose} title={item ? 'Error — ' + (item.title || '') : 'Error'}>
            <div className="text-sm text-rose-700 dark:text-rose-300 whitespace-pre-wrap">{item?.error || 'Unknown error'}</div>
        </Modal>
    );
}
