/* globals DOMParser, Node, console */

import global from '@ckeditor/ckeditor5-utils/src/dom/global';

export const supportedEntities = {
	'∑': 'sum',
	'∫': 'int',
	'∬': 'iint',
	'∭': 'iiint',
	'∮': 'oint',
	'∏': 'prod',
	'∐': 'coprod',
	'∯': 'oiint',
	'⨂': 'bigotimes',
	'⨁': 'bigoplus',
	'⨀': 'bigodot',
	'⨄': 'biguplus',
	'∰': 'oiiint',
	'⋁': 'bigvee',
	'⋀': 'bigwedge',
	'⋂': 'bigcap',
	'⋃': 'bigcup',
	'⨆': 'bigsqcup',
	'undOvr': 'int',
	'subSup': 'int',
	'±': 'pm',
	'∞': 'infty',
	'π': 'pi',
	'ρ': 'rho',
	'θ': 'theta'
};

export function normalizeEquations( htmlDocument ) {
	const parser = new DOMParser();

	const comments = findComments( htmlDocument );

	comments.forEach( comment => {
		const commentTextContent = comment.textContent;
		const re = new RegExp( /^\[if gte msEquation 12\]>((.|[\r?\n])*?)<!\[endif\]$/ );

		const found = commentTextContent.match( re );
		if ( found ) {
			let mathString = found[ 1 ];

			// Microsoft Word math specification from http://www.datypic.com/sc/ooxml/e-m_oMath-1.html

			// Add namescape
			mathString = mathString.replace( /^(<)(.*?)(>)/, ( match, p1, p2, p3 ) => {
				return p1 + p2 + ' xmlns:m=\'http://schemas.openxmlformats.org/officeDocument/2006/math\'' + p3;
			} );

			mathString = removeTag( mathString, 'span' );
			mathString = removeTag( mathString, 'span' );
			mathString = removeTag( mathString, 'i' );


			const mathDoc = parser.parseFromString( mathString, 'text/xml' );
			const rootElement = mathDoc.documentElement;

			const eqBuilder = {
				maxDepth: 0,
				parts: []
			};
			traverseElement( rootElement, eqBuilder, eqBuilder.parts, 0 );

			const equation = eqBuilder.parts.flat( eqBuilder.maxDepth + 1 ).join( '' );

			// Find equation img parent span
			const endMsEquationElement = comment.nextSibling;
			const targetElement = endMsEquationElement.nextSibling;

			// Create mathtex element
			const mathtex = global.document.createElement( 'span' );
			mathtex.classList.add( 'math-tex' );

			// Inline equation has position: relative; css class
			if ( targetElement.style.position === 'relative' ) {
				mathtex.innerHTML = '\\(' + equation + '\\)';
			} else {
				mathtex.innerHTML = '\\[' + equation + '\\]';
			}

			// Replace span with mathjax element
			const parent = comment.parentNode;
			parent.replaceChild( mathtex, targetElement );
		}
	} );
}

function findComments( el ) {
	const arr = [];
	for ( let i = 0; i < el.childNodes.length; i++ ) {
		const node = el.childNodes[ i ];
		if ( node.nodeType === Node.COMMENT_NODE ) {
			arr.push( node );
		} else {
			arr.push.apply( arr, findComments( node ) ); // eslint-disable-line
		}
	}
	return arr;
}

function removeTag( html, tag ) {
	// Not working with self-closing tags
	const re = new RegExp( '<' + tag + '((.|[\\r?\\n])*?)>((.|[\\r?\\n])*?)<\\/' + tag + '>', 'g' );
	const inside = html.replace( re, ( match, element, attributes, children ) => children );

	// Recursive
	const found = inside.match( re );
	if ( found ) {
		return removeTag( inside, tag );
	}

	return inside;
}

function traverseElement( element, eqBuilder, parts, depth ) {
	let childrenTraversed = false;
	const childrenParts = [];

	// Deeper than even?
	if ( depth > eqBuilder.maxDepth ) {
		eqBuilder.maxDepth = depth;
	}

	const tagName = element.tagName;
	switch ( tagName ) {
		// Radical Function
		case 'm:rad': {
			parts.push( '\\sqrt{' );
			parts.push( childrenParts );
			parts.push( '}' );
			break;
		}
		// Fraction Function
		case 'm:f': {
			const children = element.childNodes;
			for ( let i = 0; i < children.length; i++ ) {
				const child = children[ i ];
				if ( child.tagName === 'm:num' ) {
					const numParts = [];
					traverseElement( child, eqBuilder, numParts, depth + 1 );
					parts.push( '\\frac{' );
					parts.push( numParts );
					parts.push( '}' );
				} else if ( child.tagName === 'm:den' ) {
					const denParts = [];
					traverseElement( child, eqBuilder, denParts, depth + 1 );
					parts.push( '{' );
					parts.push( denParts );
					parts.push( '}' );
				}
			}
			childrenTraversed = true;
			break;
		}
		// Upper limit (n-ary)
		case 'm:sup': {
			parts.push( '^{' );
			parts.push( childrenParts );
			parts.push( '}' );
			break;
		}
		// Lower limit (n-ary)
		case 'm:sub': {
			parts.push( '_{' );
			parts.push( childrenParts );
			parts.push( '}' );
			break;
		}
		// Delimiter Function
		case 'm:d': {
			parts.push( '(' );
			parts.push( childrenParts );
			parts.push( ')' );
			break;
		}
		// n-ary Operator Function
		case 'm:nary': {
			const chrElement = element.querySelector( 'chr' ) || element.querySelector( 'limLoc' );
			if ( !chrElement ) {
				break;
			}
			const operatorValue = chrElement.getAttribute( 'm:val' );
			const operatorEntity = supportedEntities[ operatorValue ];
			if ( typeof operatorEntity === 'undefined' ) {
				if ( operatorValue ) {
					console.warn( 'Operator entity (' + operatorValue + ') in\'t yet supported' );
				}
				break;
			}
			parts.push( '\\' );
			parts.push( operatorEntity );

			const children = element.childNodes;
			for ( let i = 0; i < children.length; i++ ) {
				const child = children[ i ];
				if ( child.tagName === 'm:sub' ) {
					const subParts = [];
					traverseElement( child, eqBuilder, subParts, depth + 1 );
					// Todo: if content empty, don't push
					parts.push( '_{' );
					parts.push( subParts );
					parts.push( '}' );
				} else if ( child.tagName === 'm:sup' ) {
					const supParts = [];
					traverseElement( child, eqBuilder, supParts, depth + 1 );
					// Todo: if content empty, don't push
					parts.push( '^{' );
					parts.push( supParts );
					parts.push( '}' );
				} else if ( child.tagName === 'm:e' ) {
					const insideParts = [];
					traverseElement( child, eqBuilder, insideParts, depth + 1 );
					parts.push( '{' );
					parts.push( insideParts );
					parts.push( '}' );
				}
			}
			childrenTraversed = true;
			break;
		}
		// Matrix Function
		case 'm:m': {
			parts.push( '\\begin{matrix}' );

			// Rows
			const children = element.childNodes;
			for ( let i = 0; i < children.length; i++ ) {
				const child = children[ i ];
				if ( child.tagName === 'm:mr' ) {
					const rowParts = [];

					// Columns
					const grandchildren = child.childNodes;
					for ( let j = 0; j < grandchildren.length; j++ ) {
						const grandchildrenParts = [];
						traverseElement( grandchildren[ j ], eqBuilder, grandchildrenParts, depth + 1 );
						rowParts.push( grandchildrenParts );
						rowParts.push( '&' );
					}

					parts.push( rowParts );
					rowParts.push( '\\\\' );
				}
			}
			parts.push( '\\end{matrix}' );
			childrenTraversed = true;
			break;
		}
		default: {
			if ( typeof tagName !== 'undefined' ) {
				// console.warn( 'Element (' + tagName + ') is\'t supported yet' );
			}
			parts.push( childrenParts );
			break;
		}
	}

	switch ( element.nodeType ) {
		case Node.TEXT_NODE: {
			let textContent = element.textContent;
			// Try convert value to entity
			textContent = textContent.replace( /\s/g, ' ' );
			// eslint-disable-next-line
			textContent = textContent.replace( /[^\x00-\x7F]{1}/g, val => {
				const entity = supportedEntities[ val ];
				if ( typeof entity === 'undefined' ) {
					console.warn( 'Entity (' + val + ') is\'t supported yet' );
					return val;
				}
				return '{\\' + entity + '}';
				// or return '\\' + entity + ' ';
			} );

			childrenParts.push( textContent );
			break;
		}
		default: {
			break;
		}
	}

	// Default traverse
	if ( !childrenTraversed ) {
		// Recursive
		const children = element.childNodes;
		for ( let i = 0; i < children.length; i++ ) {
			traverseElement( children[ i ], eqBuilder, childrenParts, depth + 1 );
		}
	}
}
