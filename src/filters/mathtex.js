export function normalizeEquations( htmlDocument, plainString ) {
	const lines = plainString.split( /\r?\n/ );
	if ( lines.length > 1 ) {
		lines.pop();
	}

	const parts = htmlDocument.body.children;

	const partsByLines = [];

	for ( let i = 0; i < parts.length; i++ ) {
		const part = parts[ i ];
		if ( part.tagName.toLowerCase() === 'table' ) {
			const table = part;
			const rows = table.getElementsByTagName( 'tr' );
			for ( let j = 0; j < rows.length; j++ ) {
				const row = rows[ j ];
				partsByLines.push( row );
			}
		} else {
			partsByLines.push( part );
		}
	}

	if ( lines.length === partsByLines.length ) {
		for ( let i = 0; i < partsByLines.length; i++ ) {
			const part = partsByLines[ i ];
			const line = lines[ i ];

			const nodes = part.childNodes;

			let lineFromNode = '';
			let equationCounter = 0;
			for ( let j = 0; j < nodes.length; j++ ) {
				const node = nodes[ j ];
				// If node is comment
				const commentType = Node.COMMENT_NODE; // eslint-disable-line
				if ( node.nodeType === commentType ) {
					const commentNode = node;
					const comment = commentNode.textContent;
					if ( comment.match( /\[if gte msEquation 12]>/g ) ) {
						equationCounter++;
					}
				}
				// eslint-disable-next-line
				if ( node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE ) {
					lineFromNode += node.textContent;
				}
			}

			// Skip if don't have any equation
			if ( equationCounter === 0 ) {
				continue;
			}

			const equations = parseLines( line, lineFromNode, equationCounter );

			const images = part.getElementsByTagName( 'img' );
			for ( let j = 0; j < images.length; j++ ) {
				const mathtex = document.createElement( 'span' ); // eslint-disable-line
				mathtex.classList.add( 'math-tex' );
				mathtex.innerHTML = '\\(' + equations[ j ] + '\\)';

				const img = images[ j ];
				const parent = img.parentNode;
				parent.replaceChild( mathtex, img );
			}
		}
	} else {
		console.warn( 'math-tex-parse-lines-not-equals: Plain text lines count is not equal with HTML data' ); // eslint-disable-line
	}
}

function parseLines( line, lineFromNode, equationCounter ) {
	const equations = [];
	let equation = '';
	let charCounter = 0;
	let newEquation = true;
	// Todo: Check if is display equation

	// Replace all spaces to non breaking spaces.
	let lineFiltered = line;
	lineFiltered = lineFiltered.replace( /&nbsp;/g, ' ' );
	lineFiltered = lineFiltered.trim();

	// Fixme: this breaks greek letters etc.
	// Remove all extra spaces
	lineFiltered = lineFiltered.replace( /\\ /g, '' );

	// Todo: replace '\sqrtxy' to '\sqrt{x}y'
	lineFiltered = lineFiltered.replace( /\s/g, '\u00A0' ); // Replcae all spaces to non breaking spaces

	let lineFromNodeFiltered = lineFromNode;
	lineFromNodeFiltered = lineFromNodeFiltered.replace( /\r?\n|\r/g, ' ' ); // Line break is same as space
	lineFromNodeFiltered = lineFromNodeFiltered.replace( /&nbsp;/g, ' ' );
	lineFromNodeFiltered = lineFromNodeFiltered.trim();
	lineFromNodeFiltered = lineFromNodeFiltered.replace( /\s/g, '\u00A0' ); // Replcae all spaces to non breaking spaces

	// eslint-disable-next-line
	// console.log( '%c' + lineFiltered + ' %c' + lineFromNodeFiltered + ' %c', 'color:green', 'color:red','color:white' );

	// Let check line char by char
	for ( let j = 0; j < lineFiltered.length; j++ ) {
		const charFromLine = lineFiltered.charAt( j );
		const charFromNode = lineFromNodeFiltered.charAt( j - charCounter );
		// Jump to next iteration if has same char
		if ( charFromLine === charFromNode && charFromLine !== '\n' ) {
			if ( !newEquation ) {
				equations.push( equation.trim() );
				equation = '';
				newEquation = true;
			}
			continue;
		} else {
			equation += charFromLine;
			charCounter++;
			if ( newEquation ) {
				newEquation = false;
			}
		}
	}
	// Add last one
	if ( !newEquation ) {
		equations.push( equation.trim() );
		equation = '';
		newEquation = true;
	}

	if ( equations.length !== equationCounter ) {
		console.warn( 'Couldn\'t parse all equations' ); // eslint-disable-line
	}

	return equations;
}
